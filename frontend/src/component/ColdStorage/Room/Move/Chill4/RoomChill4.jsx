import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
const API_URL = import.meta.env.VITE_API_URL;

const ParkingLayoutChill6 = ({ onSlotClick }) => {
  const [rows, setRows] = useState({});
  const [columns, setColumns] = useState([]);
  const [socket, setSocket] = useState(null);
  const [reservations, setReservations] = useState(new Map()); // รักษาสถานะการจองที่จอดรถ

  // Function to format slot data
  const formatSlotData = (slotData) => {
    const columnSet = new Set(slotData.map((item) => item.slot_id[0]));
    const formattedRows = {};
    
    slotData.forEach((item) => {
      const [col, row] = [item.slot_id[0], item.slot_id.slice(1)];
      if (!formattedRows[row]) formattedRows[row] = {};
      formattedRows[row][col] = item;
    });

    return {
      columns: [...columnSet],
      rows: formattedRows
    };
  };

  // Function to fetch and update slots
  const fetchSlots = async () => {
    try {
      const response = await fetch(`${API_URL}/api/coldstorage/room`, { credentials: "include" });
      const data = await response.json();
      
      if (data.slot) {
        const slotData = data.slot.filter((item) => item.cs_id === 3 && item.slot_status);
        const formatted = formatSlotData(slotData);
        
        setColumns(formatted.columns);
        setRows(formatted.rows);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
    }
  };

  useEffect(() => {
    if (!API_URL) {
      console.error("❌ API_URL is not defined.");
      return;
    }

    // Socket connection
    const newSocket = io(API_URL, { 
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      // Fetch initial data when socket connects
      fetchSlots();
    });

    newSocket.on("disconnect", () => {
      console.warn("⚠️ Socket disconnected.");
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // Listen for slot updates
    newSocket.on("slotUpdated", async (updatedSlot) => {
      console.log("🔄 Slot update received:", updatedSlot);
      // Refresh all data when a slot is updated
      await fetchSlots();
    });

    newSocket.on("reservationError", (error) => {
      console.error("❌ Reservation error:", error.message);
      // Handle error (e.g., show toast notification)
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.off("slotUpdated");
        newSocket.off("reservationError");
        newSocket.disconnect();
      }
    };
  }, []);

  // Add periodic refresh as a fallback
  useEffect(() => {
    const refreshInterval = setInterval(fetchSlots, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Modified handleSlotClick for parent component
  // const handleSlotClick = (slotData) => {
  //   if (processingSlot === slotData.slot_id) return;
    
  //   setSelectedSlot(slotData);
  //   setProcessingSlot(slotData.slot_id);
    
  //   try {
  //     if (socket) {
  //       socket.emit("reserveSlot", {
  //         slot_id: slotData.slot_id,
  //         cs_id: slotData.cs_id,
  //       });
  //     }
  //   } catch (error) {
  //     console.error("❌ Error reserving slot:", error);
  //     setProcessingSlot(null);
  //   }
  // };

  // Modified render logic to check reservations
  const isSlotReserved = (slot) => {
    return reservations.has(`${slot.slot_id}-${slot.cs_id}`);
  };

  return (
    <div className="p-4 overflow-x-auto shadow" style={{ backgroundColor: "#fff", borderRadius: "8px" }}>
      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            <th className="px-2 py-2 bg-gray-200 text-sm md:text-base" style={{ border: "1px solid #e5e7eb", backgroundColor: "#fff" }}></th>
            {columns.map((col, index) => (
              <th key={index} className="px-2 py-2 text-sm md:text-base" style={{ border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#6B7489" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(rows).map((rowKey, rowIndex) => (
            <tr key={rowIndex}>
              <td className="px-2 py-2 text-center text-sm md:text-base" style={{ border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#6B7489" }}>
                {rowKey}
              </td>
              {columns.map((col, colIndex) => {
                const slot = rows[rowKey]?.[col];
                const isOccupied = slot?.tro_id && slot?.tro_id !== "rsrv";
                const isReserved = slot?.tro_id === "rsrv";
                const isNULL = slot?.tro_id === null;

                return (
                  <td key={colIndex} className="border px-2 py-2 text-center" style={{ backgroundColor: "#fff" }}>
                    {slot && (
                      <div
                      onClick={() => {
                        if ((!slot?.tro_id || slot?.tro_id === "NULL") || isReserved || !slot.slot_status) return;
                        onSlotClick(slot);
                      }}
                      
                        style={{
                          color: "#686868",
                          width: "220px",
                          height: "80px",
                          backgroundColor: "#fff",
                          borderLeft: `6px solid ${isReserved ? "#6B7489" : isOccupied ? "#80FF75" : "#6B7489"}`,
                          paddingTop: "20px",
                          justifyItems: "left",
                          paddingLeft: "20px",
                          cursor: !isNULL && !isReserved && slot.slot_status ? "pointer" : "default",
                        }}
                        className={`p-2 rounded-lg shadow ${!isOccupied && !isReserved && slot.slot_status ? "hover:bg-blue-100" : "opacity-100"}`}
                      >
                        {isOccupied ? (
                          <>
                            <p style={{fontSize:"18px"}}>ป้ายทะเบียน : {slot.tro_id}</p>
                            <p  style={{fontSize:"12px"}}>ย้ายวัตถุดิบ</p>
                          </>
                        ) : isReserved ? (
                          <>
                            <p style={{ textAlign: "left", color: "#686868" }}>กำลังจอง...</p>
                          </>
                        ) : (
                          <p style={{ textAlign: "left", color: "#686868" }}>
                            ช่องจอดว่าง <br /> ไม่มีรถเข็น
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ParkingLayoutChill6;
