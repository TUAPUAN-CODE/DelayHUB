import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const Table = ({ data }) => {
  const [selectedDelays, setSelectedDelays] = useState({
    DCS: true,
    DBS1: true,
    DBS2: true,
    DBS3: true
  });
  const [selectedBar, setSelectedBar] = useState(null);
  const [selectedTimeRanges, setSelectedTimeRanges] = useState({});

  if (!data) return <div className="text-gray-600 p-4">No data available</div>;

  // Initialize selected time ranges (all selected by default)
  useMemo(() => {
    if (data.delayDistribution && Object.keys(selectedTimeRanges).length === 0) {
      const ranges = {};
      data.delayDistribution.data.forEach((row, index) => {
        ranges[row[0]] = true;
      });
      setSelectedTimeRanges(ranges);
    }
  }, [data]);

  const totalCounts = {
    prepToCold: data.summary[0].values[0],
    cold: data.summary[0].values[1],
    coldToPack: data.summary[0].values[2],
    prepToPack: data.summary[0].values[3]
  };

  const barColors = {
    prepToCold: 'bg-emerald-600',
    cold: 'bg-amber-600',
    coldToPack: 'bg-rose-600',
    prepToPack: 'bg-violet-600'
  };

  const delayColors = {
    DCS: '#3b82f6',
    DBS1: '#10b981',
    DBS2: '#f59e0b',
    DBS3: '#ef4444'
  };

  const toggleDelay = (delayType) => {
    setSelectedDelays(prev => ({
      ...prev,
      [delayType]: !prev[delayType]
    }));
  };

  const toggleTimeRange = (range) => {
    setSelectedTimeRanges(prev => ({
      ...prev,
      [range]: !prev[range]
    }));
  };

  const selectAllTimeRanges = () => {
    const allSelected = {};
    data.delayDistribution.data.forEach((row) => {
      allSelected[row[0]] = true;
    });
    setSelectedTimeRanges(allSelected);
  };

  const deselectAllTimeRanges = () => {
    const allDeselected = {};
    data.delayDistribution.data.forEach((row) => {
      allDeselected[row[0]] = false;
    });
    setSelectedTimeRanges(allDeselected);
  };

  // Generate trend data from delayDistribution
  const trendData = useMemo(() => {
    if (!data.delayDistribution) return [];
    
    return data.delayDistribution.data
      .filter((row) => selectedTimeRanges[row[0]])
      .map((row, index) => {
        const range = row[0];
        
        return {
          range: range,
          DCS: row[1] || 0,      // เตรียม→เข้าห้องเย็น
          DBS1: row[2] || 0,     // เข้า→ออกห้องเย็น
          DBS2: row[3] || 0,     // ออกห้องเย็น→บรรจุเสร็จ
          DBS3: row[4] || 0      // เตรียม→บรรจุเสร็จ
        };
      });
  }, [data, selectedTimeRanges]);

  const handleBarClick = (rowIndex, cellIndex) => {
    if (selectedBar?.rowIndex === rowIndex && selectedBar?.cellIndex === cellIndex) {
      setSelectedBar(null);
    } else {
      setSelectedBar({ rowIndex, cellIndex });
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm">
      {/* Delay Type Filter Buttons */}
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-sm font-semibold mb-3 text-gray-700">Filter Delay Types:</h3>
        <div className="flex flex-wrap gap-3">
          {Object.keys(selectedDelays).map(delayType => (
            <button
              key={delayType}
              onClick={() => toggleDelay(delayType)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                selectedDelays[delayType]
                  ? 'shadow-md transform scale-105'
                  : 'opacity-50 hover:opacity-75'
              }`}
              style={{
                backgroundColor: selectedDelays[delayType] ? delayColors[delayType] : '#e5e7eb',
                color: selectedDelays[delayType] ? 'white' : '#6b7280'
              }}
            >
              {delayType} Delay
            </button>
          ))}
        </div>
      </div>

      {/* Time Range Filter Buttons */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Filter Time Ranges:</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllTimeRanges}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={deselectAllTimeRanges}
              className="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
            >
              ยกเลิกทั้งหมด
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.delayDistribution && data.delayDistribution.data.map((row, index) => {
            const range = row[0];
            return (
              <button
                key={index}
                onClick={() => toggleTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  selectedTimeRanges[range]
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {range} ชม.
              </button>
            );
          })}
        </div>
      </div>

      {/* Trend Line Chart */}
      {trendData.length > 0 && (
        <div className="px-6 pb-6">
          <h3 className="text-lg font-semibold mb-4 text-[#4aaaec] border-b pb-2 pl-2">
            Delay Distribution Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="range" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                style={{ fontSize: '12px' }}
              />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <RechartsTooltip />
              <Legend />
              {selectedDelays.DCS && (
                <Line 
                  type="monotone" 
                  dataKey="DCS" 
                  stroke={delayColors.DCS} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="เตรียม→เข้าห้องเย็น"
                />
              )}
              {selectedDelays.DBS1 && (
                <Line 
                  type="monotone" 
                  dataKey="DBS1" 
                  stroke={delayColors.DBS1} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="เข้า→ออกห้องเย็น"
                />
              )}
              {selectedDelays.DBS2 && (
                <Line 
                  type="monotone" 
                  dataKey="DBS2" 
                  stroke={delayColors.DBS2} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="ออกห้องเย็น→บรรจุเสร็จ"
                />
              )}
              {selectedDelays.DBS3 && (
                <Line 
                  type="monotone" 
                  dataKey="DBS3" 
                  stroke={delayColors.DBS3} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="เตรียม→บรรจุเสร็จ"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Main Summary Table */}
      <div className="mb-8 px-6 pt-6">
        <h3 className="text-lg font-semibold mb-4 text-[#4aaaec] border-b pb-2 pl-2">
          ประเภทวัตถุดิบ: <span className="text-gray-700">{data.metadata.groupName}</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <tbody>
              {data.summary.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-200 px-6 py-3 font-medium text-gray-700">{row.label}</td>
                  {row.values.map((value, colIndex) => (
                    <td key={colIndex} className="border border-gray-200 px-6 py-3 text-center">
                      {row.label === "N" ? Math.round(value) : 
                       typeof value === 'number' ? value.toFixed(1) : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delay Distribution Table */}
      <div className="mt-8 px-6 pb-6">
        <h3 className="text-lg font-semibold mb-4 text-[#4aaaec] border-b pb-2 pl-2">
          Delay Time Distribution (hours)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-[#4aaaec] text-white">
                {data.delayDistribution.headers.map((header, index) => (
                  <th key={index} className="border border-gray-200 px-6 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.delayDistribution.data
                .filter((row) => selectedTimeRanges[row[0]])
                .map((row, rowIndex) => {
                  const originalRowIndex = data.delayDistribution.data.indexOf(row);
                  return (
                    <tr key={originalRowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      {row.map((cell, cellIndex) => {
                        if (cellIndex >= 1 && cellIndex <= 4) {
                          const total = totalCounts[
                            cellIndex === 1 ? 'prepToCold' : 
                            cellIndex === 2 ? 'cold' : 
                            cellIndex === 3 ? 'coldToPack' : 'prepToPack'
                          ];
                          const percentage = total > 0 ? (cell / total) * 100 : 0;
                          
                          // Estimate weight based on percentage of total
                          const estimatedWeight = (cell / total) * data.metadata.sampleSize * 200; // Assuming avg 200kg per item

                          const colorClass = [
                            '', 
                            barColors.prepToCold,
                            barColors.cold,
                            barColors.coldToPack,
                            barColors.prepToPack
                          ][cellIndex];

                          const isSelected = selectedBar?.rowIndex === originalRowIndex && selectedBar?.cellIndex === cellIndex;
                          
                          return (
                            <td 
                              key={cellIndex} 
                              className={`border border-gray-200 px-6 py-3 relative group cursor-pointer transition-all ${
                                isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                              }`}
                              onClick={() => handleBarClick(originalRowIndex, cellIndex)}
                            >
                              <div className="flex items-center justify-between z-10 relative">
                                <span>{Math.round(cell)}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div 
                                className={`absolute inset-y-0 left-0 ${colorClass} opacity-90 rounded-r-md`}
                                style={{ 
                                  width: `${percentage}%`,
                                  transition: 'width 0.3s ease'
                                }}
                              ></div>
                              <div className="absolute inset-y-0 left-0 bg-gray-200 opacity-30 w-full rounded-r-md">
                              </div>
                              
                              {/* Tooltip on hover */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-20 pointer-events-none">
                                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                  <div>ปกติ: {estimatedWeight.toFixed(1)} kg ({percentage.toFixed(1)}%)</div>
                                  <div className="mt-1">จำนวน: {Math.round(cell)} รายการ</div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td key={cellIndex} className="border border-gray-200 px-6 py-3 text-center">
                            {typeof cell === 'number' ? cell.toFixed(1) : cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail info when bar is clicked */}
      {selectedBar && (
        <div className="mt-8 px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#4aaaec] border-b pb-2 pl-2">
              รายละเอียด - {data.delayDistribution.data[selectedBar.rowIndex][0]} ชั่วโมง
            </h3>
            <button
              onClick={() => setSelectedBar(null)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              ปิด
            </button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">ช่วงเวลา</p>
                <p className="text-lg font-semibold text-gray-800">
                  {data.delayDistribution.data[selectedBar.rowIndex][0]} ชั่วโมง
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ประเภทขั้นตอน</p>
                <p className="text-lg font-semibold text-gray-800">
                  {data.delayDistribution.headers[selectedBar.cellIndex]}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">จำนวนรายการ</p>
                <p className="text-lg font-semibold text-gray-800">
                  {Math.round(data.delayDistribution.data[selectedBar.rowIndex][selectedBar.cellIndex])} รายการ
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">เปอร์เซ็นต์</p>
                <p className="text-lg font-semibold text-gray-800">
                  {((data.delayDistribution.data[selectedBar.rowIndex][selectedBar.cellIndex] / 
                    totalCounts[
                      selectedBar.cellIndex === 1 ? 'prepToCold' : 
                      selectedBar.cellIndex === 2 ? 'cold' : 
                      selectedBar.cellIndex === 3 ? 'coldToPack' : 'prepToPack'
                    ]) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                💡 คลิกแท่งอื่นเพื่อดูข้อมูลเพิ่มเติม หรือคลิกปุ่ม "ปิด" เพื่อซ่อน
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Section */}
      <div className="mt-6 mx-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-[#4aaaec]">Group:</span> {data.metadata.groupName}
          </div>
          <div>
            <span className="font-medium text-[#4aaaec]">Type:</span> {data.metadata.rmType}
          </div>
          <div>
            <span className="font-medium text-[#4aaaec]">Sample Size:</span> {data.metadata.sampleSize}
          </div>
        </div>
      </div>
      
      {/* Legend Section */}
      <div className="mt-4 mx-6 pb-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center">
          <div className={`w-4 h-4 ${barColors.prepToCold} rounded mr-2`}></div>
          <span>เตรียม→เข้าห้องเย็น</span>
        </div>
        <div className="flex items-center">
          <div className={`w-4 h-4 ${barColors.cold} rounded mr-2`}></div>
          <span>เข้า→ออกห้องเย็น</span>
        </div>
        <div className="flex items-center">
          <div className={`w-4 h-4 ${barColors.coldToPack} rounded mr-2`}></div>
          <span>ออกห้องเย็น→บรรจุเสร็จ</span>
        </div>
        <div className="flex items-center">
          <div className={`w-4 h-4 ${barColors.prepToPack} rounded mr-2`}></div>
          <span>เตรียม→บรรจุเสร็จ</span>
        </div>
      </div>
    </div>
  );
};

export default Table;