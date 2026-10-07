// Delay time of one material of a trolley in the large cold room — moved unchanged from the old check-out table (CheckOut/Asset/Table.jsx).
// ModalEditPD (check-out) shows these values for every material.
const API_URL = import.meta.env.VITE_API_URL;

const updateRmStatus = async (mapping_id) => {
  try {
    console.log('Attempting to update status for mapping_id:', mapping_id);

    const response = await fetch(`${API_URL}/api/clodstorage/rmInTrolley`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapping_id: mapping_id,
        rm_status: 'รอแก้ไข'
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    console.log('Update status response:', data);

    return data;
  } catch (error) {
    console.error('Error updating RM status:', error);
    return null; // fire-and-forget caller: never let the status update break the delay calculation
  }
};

const calculateTimeDifference = (ComeColdDateTime) => {
  const comecolddatetime = new Date(ComeColdDateTime);
  const currentDate = new Date();
  console.log("เวลาเข้าห้องเย็นล่าสุด : ", comecolddatetime);
  console.log("เวลาปัจจุบัน : ", currentDate);
  return (currentDate - comecolddatetime) / (1000 * 60);
};

// ปรับปรุงฟังก์ชัน formatTime เพื่อให้แสดงเวลาอย่างถูกต้อง
const formatTime = (minutes) => {
  if (isNaN(minutes) || minutes === null) return "-";

  const absMinutes = Math.abs(minutes);
  const days = Math.floor(absMinutes / 1440);
  const hours = Math.floor((absMinutes % 1440) / 60);
  const mins = Math.floor(absMinutes % 60);

  let timeString = '';
  if (days > 0) timeString += `${days} วัน`;
  if (hours > 0) timeString += `${timeString.length > 0 ? ' ' : ''}${hours} ชม.`;
  if (mins > 0 || (days === 0 && hours === 0)) timeString += `${timeString.length > 0 ? ' ' : ''}${mins} นาที`;
  return timeString.trim();
};


const getLatestComeColdDateForMaterial = (material) => {
  // เก็บวันที่ทั้งหมดในอาร์เรย์
  const dates = [
    material.cs_come_cold_date,
    material.cs_come_cold_date_two,
    material.cs_come_cold_date_three
  ].filter(date => date); // กรองเอาเฉพาะค่าที่ไม่เป็น null หรือ undefined

  console.log("เวลาเข้าห้องเย็นทั้งหมดของวัตถุดิบ:", material.material, dates);
  if (dates.length === 0) return null;

  // แปลงเป็น Date objects
  const dateObjects = dates.map(date => new Date(date));

  // หาวันที่ล่าสุด
  return new Date(Math.max(...dateObjects)).toISOString().replace('T', ' ');
};

const calculateTimeDifferenceForMaterial = (comeColdDateTime) => {
  if (!comeColdDateTime) return null;
  const comecolddatetime = new Date(comeColdDateTime);
  const currentDate = new Date();
  return (currentDate - comecolddatetime) / (1000 * 60);
};


// ปรับปรุงฟังก์ชัน calculateMaterialDelayTime เพื่อแก้ไขวิธีการคำนวณเวลาสำหรับวัตถุดิบผสม
const calculateMaterialDelayTime = (material) => {
  console.log("Calculating delay time for material:", material);

  const checkAndUpdateMaterialStatus = (material, percentage) => {
    if (percentage > 100 && material.materialStatus !== "รอแก้ไข" && material.mapping_id) {
      try {
        updateRmStatus(material.mapping_id);
        console.log(`Updated status to "รอแก้ไข" for material ${material.material_code}`);
        return true;
      } catch (error) {
        console.error(`Failed to update status for material ${material.material_code}:`, error);
        return false;
      }
    }
    return false;
  };

  // เช็คว่าเป็นวัตถุดิบผสมหรือไม่ โดยดูจาก mix_time และ rawMatType
  if (material.rawMatType === "mixed" && material.mix_time !== null && material.mix_time !== undefined) {
    console.log(`Material ${material.material_code} is a mixed material with mix_time:`, material.mix_time);

    // หาวันที่เข้าห้องเย็นล่าสุดของวัตถุดิบนี้
    const latestComeColdDate = getLatestComeColdDateForMaterial(material);
    console.log("วันที่เข้าห้องเย็นล่าสุดของวัตถุดิบผสม:", material.material_code, latestComeColdDate);

    if (!latestComeColdDate) {
      return {
        statusMessage: "รอดำเนินการ",
        color: "#626262",
        delayTimeValue: null
      };
    }

    // แปลงค่า mix_time จากรูปแบบ ชั่วโมง.นาที เป็นนาทีทั้งหมด
    const mixTimeValue = parseFloat(material.mix_time);
    const mixTimeMinutes = Math.floor(Math.abs(mixTimeValue)) * 60 + (Math.abs(mixTimeValue) % 1) * 100;
    console.log(`Material ${material.material_code} mixTimeMinutes:`, mixTimeMinutes);

    // คำนวณเวลาที่ผ่านไปจริงตั้งแต่เข้าห้องเย็น
    const standardTime = 120;
    const timePassed = calculateTimeDifferenceForMaterial(latestComeColdDate);
    console.log(`Material ${material.material_code} time passed since entering cold room (minutes):`, timePassed);

    if (mixTimeValue < 0) {
      const exceededMinutesFromMix = mixTimeMinutes;
      const rs_exceededMinutesFromMix = -1 * exceededMinutesFromMix - timePassed;
      console.log(`การคำนวนเวลาที่เหลืออยู่ ${rs_exceededMinutesFromMix}= -1 * ${exceededMinutesFromMix} - ${timePassed}`)
      console.log("Material exceeded minutes from mix_time:", rs_exceededMinutesFromMix);

      const percentage = ((standardTime + (-1 * rs_exceededMinutesFromMix)) / standardTime) * 100;
      console.log(`เปอร์เซ็นของ mix_time < 0 (${standardTime} + ${-1 * rs_exceededMinutesFromMix}) / ${standardTime} = ${percentage}`);
      console.log("Material percentage (exceeded): mix_time < 0", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(rs_exceededMinutesFromMix)}`,
        color: "red",
        delayTimeValue: mixTimeValue,
        isOverdue: true
      };
    }

    // กรณีที่ค่า mix_time = 0 แสดงว่าหมดเวลาพอดี
    if (mixTimeValue === 0) {
      const percentage = ((standardTime + timePassed) / standardTime) * 100;
      console.log("Material percentage (exceeded) mix_time = 0:", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(timePassed)}`,
        color: "red",
        delayTimeValue: 0
      };
    }


    // ตรวจสอบว่าเวลาที่ผ่านไปจริงมากกว่าเวลาที่กำหนดจาก mix_time หรือไม่
    if (timePassed > mixTimeMinutes) {
      const exceededMinutes = timePassed - mixTimeMinutes;
      console.log(`Material ${material.material_code} exceeded minutes:`, exceededMinutes);

      // คำนวณ percentage สำหรับกรณีเกินเวลา
      const percentage = ((standardTime + exceededMinutes) / standardTime) * 100;
      console.log(`Material ${material.material_code} percentage (exceeded):`, percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      // คำนวณค่า mix_time ที่ปรับปรุงแล้ว (เป็นค่าลบ)
      // แปลงจากนาทีเป็นรูปแบบ ชั่วโมง.นาที (ติดลบ)
      const updatedMixTime = -1 * (Math.floor(exceededMinutes / 60) + ((exceededMinutes % 60) / 100));

      return {
        statusMessage: `เลยกำหนด ${formatTime(exceededMinutes)}`,
        color: "red",
        delayTimeValue: updatedMixTime,
        isOverdue: true
      };
    }

    // กรณีที่ยังไม่เกินเวลา

    const resultRemainning = standardTime - mixTimeMinutes;
    const timeRemaining = mixTimeMinutes - timePassed;
    console.log(`Material ${material.material_code} time remaining (minutes):`, timeRemaining);

    // คำนวณเปอร์เซ็นต์
    const percentage = ((resultRemainning + timePassed) / standardTime) * 100;

    console.log(`Material ${material.material_code} percentage:`, percentage);

    checkAndUpdateMaterialStatus(material, percentage);

    // กำหนดสีตามเปอร์เซ็นต์
    let color;
    if (percentage >= 100) color = "red";
    else if (percentage >= 70) color = "orange";
    else color = "green";

    // คำนวณค่า mix_time ที่ปรับปรุงแล้ว
    // แปลงจากนาทีกลับเป็นรูปแบบ ชั่วโมง.นาที
    const updatedMixTime = Math.floor(timeRemaining / 60) + ((timeRemaining % 60) / 100);

    return {
      statusMessage: `เหลืออีก ${formatTime(timeRemaining)}`,
      color,
      delayTimeValue: updatedMixTime
    };
  }

  // หาวันที่เข้าห้องเย็นล่าสุดของวัตถุดิบนี้
  const latestComeColdDate = getLatestComeColdDateForMaterial(material);
  console.log("วันที่เข้าห้องเย็นล่าสุดของวัตถุดิบ:", material.material_code, latestComeColdDate);

  if (!latestComeColdDate) {
    return {
      statusMessage: "รอดำเนินการ",
      color: "#626262",
      delayTimeValue: null
    };
  }

  // ตรวจสอบว่ามี remaining_rework_time หรือไม่
  if (material.remaining_rework_time !== null && material.remaining_rework_time !== undefined) {
    console.log(`Material ${material.material_code} ใช้ remaining_rework_time:`, material.remaining_rework_time);

    // ใช้ข้อมูล remaining_rework_time จากวัตถุดิบ
    const remainingReworkTime = parseFloat(material.remaining_rework_time);

    // ใช้ standard_rework_time จากวัตถุดิบ
    const standardReworkTime = parseFloat(material.standard_rework_time);
    console.log(`Material ${material.material_code} standard_rework_time:`, standardReworkTime);

    // แปลงค่า standard_rework_time จากรูปแบบ ชั่วโมง.นาที เป็นนาทีทั้งหมด
    const standardReworkTimeMinutes = Math.floor(standardReworkTime) * 60 + (standardReworkTime % 1) * 100;
    console.log("Material standard rework minutes:", standardReworkTimeMinutes);

    // คำนวณเวลาที่ผ่านไปจริงตั้งแต่เข้าห้องเย็น
    const timePassed = calculateTimeDifferenceForMaterial(latestComeColdDate);
    console.log("Material time passed (minutes):", timePassed);

    // กรณีที่ค่า remaining_rework_time เป็นลบ - แสดงว่าเลยกำหนดแล้ว
    if (remainingReworkTime < 0) {
      const exceededMinutes = Math.floor(Math.abs(remainingReworkTime)) * 60 + (Math.abs(remainingReworkTime) % 1) * 100;
      console.log("Material exceeded minutes:", exceededMinutes);
      const rs_exceededMinutesFormRework = -1 * exceededMinutes - timePassed;

      const percentage = ((standardReworkTimeMinutes + (-1 * rs_exceededMinutesFormRework)) / standardReworkTimeMinutes) * 100;
      console.log("Material percentage (exceeded) rework < 0:", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(rs_exceededMinutesFormRework)}`,
        color: "red",
        delayTimeValue: remainingReworkTime,
        isOverdue: true
      };
    }

    // กรณีที่ค่า remaining_rework_time = 0 แสดงว่าหมดเวลาพอดี
    if (remainingReworkTime === 0) {

      const percentage = ((standardReworkTimeMinutes + timePassed) / standardReworkTimeMinutes) * 100;
      console.log("Material percentage (exceeded) rework = 0:", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(timePassed)}`,
        color: "red",
        delayTimeValue: 0
      };
    }

    // กรณีที่ค่า remaining_rework_time เป็นบวกและมากกว่า 0 - ยังมีเวลาเหลือ
    const remainingReworkTimeMinutes = Math.floor(remainingReworkTime) * 60 + (remainingReworkTime % 1) * 100;
    console.log("Material remaining rework time minutes:", remainingReworkTimeMinutes);

    // เวลาที่เหลือคือ remaining_rework_time
    const timeRemaining = remainingReworkTimeMinutes - timePassed;
    const resultRemainningRework = standardReworkTimeMinutes - remainingReworkTimeMinutes
    console.log("Material time remaining (minutes):", timeRemaining);

    // คำนวณเปอร์เซ็นต์
    const percentage = ((timePassed + resultRemainningRework) / standardReworkTimeMinutes) * 100;

    console.log("Material percentage:", percentage);

    // ตรวจสอบว่าเปอร์เซ็นต์เกิน 100% และสถานะยังไม่ใช่ "รอแก้ไข"
    if (percentage >= 100 && material.materialStatus !== "รอแก้ไข" && material.mapping_id) {
      try {
        updateRmStatus(material.mapping_id);
        console.log(`Updated status to "รอแก้ไข" for material ${material.material_code}`);
      } catch (error) {
        console.error(`Failed to update status for material ${material.material_code}:`, error);
      }
    }

    // กำหนดสีตามเปอร์เซ็นต์
    let color;
    if (percentage >= 100) color = "red";
    else if (percentage >= 70) color = "orange";
    else color = "green";

    // คำนวณค่า rework_time ที่ปรับปรุงแล้ว
    // แปลงจากนาทีกลับเป็นรูปแบบ ชั่วโมง.นาที
    const updatedReworkTime = Math.floor(timeRemaining / 60) + ((timeRemaining % 60) / 100);

    return {
      statusMessage: `เหลืออีก ${formatTime(timeRemaining)}`,
      color,
      delayTimeValue: updatedReworkTime
    };
  }
  // กรณีไม่มี remaining_rework_time ให้ใช้การคำนวณแบบเดิม (ใช้ cold_time)
  else {
    // ใช้ข้อมูล cold_time จากตัวข้อมูลวัตถุดิบแต่ละรายการ
    const coldValue = parseFloat(material.cold_time);
    console.log(`Material ${material.material_code} cold_time:`, coldValue);

    const standardCold = parseFloat(material.standard_cold);
    console.log(`Material ${material.material_code} standard_cold:`, standardCold);

    // แปลงค่า standard_cold จากรูปแบบ ชั่วโมง.นาที เป็นนาทีทั้งหมด
    const standardColdMinutes = Math.floor(standardCold) * 60 + (standardCold % 1) * 100;
    console.log("Material standard cold minutes:", standardColdMinutes);

    // คำนวณเวลาที่ผ่านไปจริงตั้งแต่เข้าห้องเย็น
    const timePassed = calculateTimeDifferenceForMaterial(latestComeColdDate);
    console.log("Material time passed (minutes):", timePassed);

    // กรณีที่ค่า cold เป็นลบ - แสดงว่าเลยกำหนดแล้ว
    if (coldValue < 0) {
      const exceededMinutesFromCold = Math.floor(Math.abs(coldValue)) * 60 + (Math.abs(coldValue) % 1) * 100;
      const rs_exceededMinutesFromCold = -1 * exceededMinutesFromCold - timePassed;
      console.log("Material exceeded minutes:", rs_exceededMinutesFromCold);

      const percentage = ((standardColdMinutes + (-1 * rs_exceededMinutesFromCold)) / standardColdMinutes) * 100;

      console.log(`เปอร์เซ็นของ cold < 0 (${standardColdMinutes} + ${-1 * rs_exceededMinutesFromCold}) / ${standardColdMinutes} = ${percentage}`)
      console.log("Material percentage (exceeded): coldtime < 0", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(rs_exceededMinutesFromCold)}`,
        color: "red",
        delayTimeValue: coldValue,
        isOverdue: true
      };
    }

    // กรณีที่ค่า cold = 0 แสดงว่าหมดเวลาพอดี
    if (coldValue === 0) {

      const percentage = ((standardColdMinutes + timePassed) / standardColdMinutes) * 100;
      console.log("Material percentage (exceeded) coldtime = 0 :", percentage);

      checkAndUpdateMaterialStatus(material, percentage);

      return {
        statusMessage: `เลยกำหนด ${formatTime(timePassed)}`,
        color: "red",
        delayTimeValue: 0
      };
    }

    // กรณีที่ค่า cold เป็นบวกและมากกว่า 0 - ยังมีเวลาเหลือ
    const coldValueMinutes = Math.floor(coldValue) * 60 + (coldValue % 1) * 100;

    // ตรวจสอบว่าเวลาที่ผ่านไปจริงมากกว่าเวลาที่เหลือจาก cold หรือไม่
    if (timePassed > coldValueMinutes) {
      const exceededMinutes = timePassed - coldValueMinutes;
      console.log("Material exceeded minutes from real time:", exceededMinutes);

      const percentage = ((standardColdMinutes + exceededMinutes) / standardColdMinutes) * 100;

      checkAndUpdateMaterialStatus(material, percentage);

      // คำนวณค่า cold_time ที่ปรับปรุงแล้ว (เป็นค่าลบ)
      // แปลงจากนาทีเป็นรูปแบบ ชั่วโมง.นาที (ติดลบ)
      const updatedColdTime = -1 * (Math.floor(exceededMinutes / 60) + ((exceededMinutes % 60) / 100));

      return {
        statusMessage: `เลยกำหนด ${formatTime(exceededMinutes)}`,
        color: "red",
        delayTimeValue: updatedColdTime
      };
    }

    // กรณีที่ยังไม่เกินเวลา
    const timeRemaining = coldValueMinutes - timePassed;
    const resultRemainningCold = standardColdMinutes - coldValueMinutes;
    console.log("Material time remaining (minutes):", timeRemaining);

    console.log(`การคำนวณ percentage: ${resultRemainningCold} = ${standardColdMinutes} - ${coldValueMinutes}`)

    // คำนวณเปอร์เซ็นต์
    const percentage = ((timePassed + resultRemainningCold) / standardColdMinutes) * 100;
    console.log("Material percentage:", percentage);

    checkAndUpdateMaterialStatus(material, percentage);

    // กำหนดสีตามเปอร์เซ็นต์
    let color;
    if (percentage >= 100) color = "red";
    else if (percentage >= 70) color = "orange";
    else color = "green";

    // คำนวณค่า cold_time ที่ปรับปรุงแล้ว
    // แปลงจากนาทีกลับเป็นรูปแบบ ชั่วโมง.นาที
    const updatedColdTime = Math.floor(timeRemaining / 60) + ((timeRemaining % 60) / 100);

    return {
      statusMessage: `เหลืออีก ${formatTime(timeRemaining)}`,
      color,
      delayTimeValue: updatedColdTime
    };
  }
};

export { calculateMaterialDelayTime };
