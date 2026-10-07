import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Package, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const ProductionLineDelayDashboard = () => {
  const [lineData, setLineData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedRmType, setSelectedRmType] = useState('all');
  const [rmTypes, setRmTypes] = useState([]);
  const [selectedMatName, setSelectedMatName] = useState('all');
  const [matNames, setMatNames] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [detailsTableData, setDetailsTableData] = useState([]);
  const [isRmTypeOpen, setIsRmTypeOpen] = useState(false);
  const [rmTypeSearch, setRmTypeSearch] = useState("");
  const [isMatNameOpen, setIsMatNameOpen] = useState(false);
  const [matNameSearch, setMatNameSearch] = useState("");
  const [matNameSort, setMatNameSort] = useState('asc');
  const [selectedDelayPeriod, setSelectedDelayPeriod] = useState('dbs3'); // 'dbs3' or 'dbs2'

  const filteredRmTypes = rmTypes.filter(type =>
    type.toLowerCase().includes(rmTypeSearch.toLowerCase())
  );

  const filteredMatNames = matNames
    .filter(name =>
      name.toLowerCase().includes(matNameSearch.toLowerCase())
    )
    .sort((a, b) =>
      matNameSort === "asc"
        ? a.localeCompare(b)
        : b.localeCompare(a)
    );

  const formatDateForAPI = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

 

     const formatDateForDisplay = (dateString) => {
      if (!dateString) return "";
      return dateString.split("T")[0];
    };

  const processLineData = (data, rmTypeFilter, matNameFilter, delayPeriod) => {
    let filteredData = data;

    if (rmTypeFilter !== 'all') {
      filteredData = filteredData.filter(item => item.rm_type_name === rmTypeFilter);
    }

    if (matNameFilter !== 'all') {
      filteredData = filteredData.filter(item => item.mat_name === matNameFilter);
    }

    const groupedByDateAndLine = {};

    filteredData.forEach(item => {
      const date = formatDateForDisplay(item.sc_pack_date);
      const line = item.rmm_line_name || 'Unknown Line';
      const key = `${date}_${line}`;

      if (!groupedByDateAndLine[key]) {
        groupedByDateAndLine[key] = {
          date: date,
          line: line,
          total_weight: 0,
          dbs3_delay_weight: 0,
          dbs3_normal_weight: 0,
          dbs2_delay_weight: 0,
          dbs2_normal_weight: 0,
          count_total: 0,
          count_dbs3_delay: 0,
          count_dbs2_delay: 0
        };
      }

      const weight = item.weight_RM || 0;
      groupedByDateAndLine[key].total_weight += weight;
      groupedByDateAndLine[key].count_total += 1;

      // DBS3: ออกห้องเย็น-บรรจุเสร็จ
      if (item.dbs3_status === 'delay') {
        groupedByDateAndLine[key].dbs3_delay_weight += weight;
        groupedByDateAndLine[key].count_dbs3_delay += 1;
      } else {
        groupedByDateAndLine[key].dbs3_normal_weight += weight;
      }

      // DBS2: เตรียมเสร็จ-บรรจุเสร็จ
      if (item.dbs2_status === 'delay') {
        groupedByDateAndLine[key].dbs2_delay_weight += weight;
        groupedByDateAndLine[key].count_dbs2_delay += 1;
      } else {
        groupedByDateAndLine[key].dbs2_normal_weight += weight;
      }
    });

    const lineDataArray = Object.values(groupedByDateAndLine).map(item => {
      const dbs3DelayPercent = item.total_weight > 0
        ? (item.dbs3_delay_weight / item.total_weight) * 100
        : 0;
      const dbs2DelayPercent = item.total_weight > 0
        ? (item.dbs2_delay_weight / item.total_weight) * 100
        : 0;

      // % วัตถุดิบที่ไม่เกิดความล่าช้า based on selected period
      const nonDelayPercent = delayPeriod === 'dbs3'
        ? 100 - dbs3DelayPercent
        : 100 - dbs2DelayPercent;

      return {
        date: item.date,
        line: item.line,
        total_weight: item.total_weight,
        dbs3_delay: dbs3DelayPercent,
        dbs3_normal: 100 - dbs3DelayPercent,
        dbs3_delay_weight: item.dbs3_delay_weight,
        dbs3_normal_weight: item.dbs3_normal_weight,
        dbs2_delay: dbs2DelayPercent,
        dbs2_normal: 100 - dbs2DelayPercent,
        dbs2_delay_weight: item.dbs2_delay_weight,
        dbs2_normal_weight: item.dbs2_normal_weight,
        nonDelayPercent: nonDelayPercent,
        count_total: item.count_total,
        count_dbs3_delay: item.count_dbs3_delay,
        count_dbs2_delay: item.count_dbs2_delay
      };
    });

    lineDataArray.sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.line.localeCompare(b.line);
    });

    return lineDataArray;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', formatDateForAPI(startDate));
      if (endDate) params.append('end_date', formatDateForAPI(endDate));

      const response = await fetch(`${API_URL}/api/report/rm-delay/line?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setRawData(result.data);

        const uniqueRmTypes = [...new Set(result.data.map(item => item.rm_type_name))];
        setRmTypes(uniqueRmTypes.sort());

        const uniqueMatNames = [...new Set(result.data.map(item => item.mat_name))];
        const sortedMatNames = matNameSort === 'asc'
          ? uniqueMatNames.sort()
          : uniqueMatNames.sort().reverse();
        setMatNames(sortedMatNames);

        const processedData = processLineData(result.data, selectedRmType, selectedMatName, selectedDelayPeriod);
        setLineData(processedData);
      } else {
        setRawData([]);
        setLineData([]);
        setRmTypes([]);
        setMatNames([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setRawData([]);
      setLineData([]);
      setRmTypes([]);
      setMatNames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (rawData.length > 0) {
      const uniqueMatNames = [...new Set(rawData.map(item => item.mat_name))];
      const sortedMatNames = matNameSort === 'asc'
        ? uniqueMatNames.sort()
        : uniqueMatNames.sort().reverse();
      setMatNames(sortedMatNames);

      const processedData = processLineData(rawData, selectedRmType, selectedMatName, selectedDelayPeriod);
      setLineData(processedData);
    }
  }, [selectedRmType, selectedMatName, matNameSort, rawData, selectedDelayPeriod]);

  const handleDateFilter = () => {
    fetchData();
  };

  const resetDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedRmType('all');
    setSelectedMatName('all');
    setMatNameSort('asc');
    setSelectedLine(null);
    setDetailsTableData([]);
    setSelectedDelayPeriod('dbs3');
    fetchData();
  };

  const handleCardClick = (lineItem) => {
    setSelectedLine(lineItem);

    let filteredData = rawData.filter(item =>
      formatDateForDisplay(item.sc_pack_date) === lineItem.date &&
      (item.rmm_line_name || 'Unknown Line') === lineItem.line
    );

    if (selectedRmType !== 'all') {
      filteredData = filteredData.filter(item => item.rm_type_name === selectedRmType);
    }
    if (selectedMatName !== 'all') {
      filteredData = filteredData.filter(item => item.mat_name === selectedMatName);
    }

    setDetailsTableData(filteredData);
  };

  const getPercentColor = (percent) => {
    if (percent >= 95) return 'bg-green-50 border-green-500';
    if (percent >= 85) return 'bg-yellow-50 border-yellow-500';
    if (percent >= 75) return 'bg-orange-50 border-orange-500';
    return 'bg-red-50 border-red-500';
  };

  const getPercentTextColor = (percent) => {
    if (percent >= 95) return 'text-green-700';
    if (percent >= 85) return 'text-yellow-700';
    if (percent >= 75) return 'text-orange-700';
    return 'text-red-700';
  };

  const getPercentIcon = (percent) => {
    if (percent >= 95) return <CheckCircle className="w-8 h-8 text-green-600" />;
    if (percent >= 85) return <TrendingUp className="w-8 h-8 text-yellow-600" />;
    if (percent >= 75) return <TrendingDown className="w-8 h-8 text-orange-600" />;
    return <AlertCircle className="w-8 h-8 text-red-600" />;
  };

  const DateInput = ({ value, onChange, placeholder, minDate }) => {
    const handleChange = (e) => {
      const dateValue = e.target.value;
      onChange(dateValue ? new Date(dateValue) : null);
    };

    return (
      <input
        type="date"
        value={value ? formatDateForAPI(value) : ''}
        onChange={handleChange}
        min={minDate ? formatDateForAPI(minDate) : undefined}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 px-3 py-2 border"
        placeholder={placeholder}
      />
    );
  };

  const renderDelayPeriodSelector = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">เลือกช่วงเวลา Delay ที่ต้องการดู:</h3>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setSelectedDelayPeriod('dbs3')}
          className={`flex-1 min-w-[250px] px-6 py-4 rounded-lg font-medium transition-all duration-300 ${selectedDelayPeriod === 'dbs3'
              ? 'bg-red-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          <div className="text-left">
            <div className="text-lg font-bold mb-1">ช่วงที่ 3</div>
            <div className="text-sm opacity-90">ออกห้องเย็น → บรรจุเสร็จ</div>
          </div>
        </button>
        <button
          onClick={() => setSelectedDelayPeriod('dbs2')}
          className={`flex-1 min-w-[250px] px-6 py-4 rounded-lg font-medium transition-all duration-300 ${selectedDelayPeriod === 'dbs2'
              ? 'bg-orange-500 text-white shadow-lg transform scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          <div className="text-left">
            <div className="text-lg font-bold mb-1">ช่วงที่ 4</div>
            <div className="text-sm opacity-90">เตรียมเสร็จ → บรรจุเสร็จ</div>
          </div>
        </button>
      </div>
    </div>
  );

  const renderFilterSection = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">ตัวกรองข้อมูล</h2>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">กรองตามวันที่บรรจุเสร็จ (SC Pack Date)</h3>
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">เริ่มต้นวันที่</label>
            <DateInput
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สิ้นสุด</label>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
              minDate={startDate}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDateFilter}
              className="px-4 py-2 bg-[#1552F0] text-white rounded-md hover:bg-[#3a92d4] focus:outline-none focus:ring-2 focus:ring-[#1552F0] focus:ring-opacity-50 transition-colors"
            >
              ยืนยัน
            </button>
            <button
              onClick={resetDateFilter}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-colors"
            >
              รีเซ็ต
            </button>
          </div>
        </div>
        {(startDate || endDate) && (
          <div className="mt-3 text-sm text-gray-600 bg-blue-50 p-2 rounded">
            Showing data where SC Pack Date between:
            {startDate && ` ${formatDateForAPI(startDate)}`}
            {endDate && ` to ${formatDateForAPI(endDate)}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เลือกประเภทวัตถุดิบ (RM Type):
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRmTypeOpen(!isRmTypeOpen)}
              className="w-full flex justify-between items-center rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1552F0]"
            >
              <span className="truncate">
                {selectedRmType === "all" ? "ทั้งหมด (All)" : selectedRmType}
              </span>
              <span>▾</span>
            </button>

            {isRmTypeOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="ค้นหาประเภทวัตถุดิบ..."
                    value={rmTypeSearch}
                    onChange={(e) => setRmTypeSearch(e.target.value)}
                    className="w-full rounded-md border-gray-300 px-2 py-1 text-sm focus:border-[#1552F0] focus:ring focus:ring-[#1552F0]"
                  />
                </div>
                <ul className="max-h-60 overflow-auto text-sm">
                  <li
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedRmType === "all" ? "bg-blue-50 font-medium" : ""}`}
                    onClick={() => {
                      setSelectedRmType("all");
                      setIsRmTypeOpen(false);
                    }}
                  >
                    ทั้งหมด (All)
                  </li>
                  {filteredRmTypes.length === 0 && (
                    <li className="px-3 py-2 text-gray-400">ไม่พบข้อมูล</li>
                  )}
                  {filteredRmTypes.map(type => (
                    <li
                      key={type}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedRmType === type ? "bg-blue-50 font-medium" : ""}`}
                      onClick={() => {
                        setSelectedRmType(type);
                        setIsRmTypeOpen(false);
                      }}
                    >
                      {type}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เลือกวัตถุดิบ (Mat Name):
          </label>
          <button
            type="button"
            onClick={() => setIsMatNameOpen(!isMatNameOpen)}
            className="w-full flex justify-between items-center rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1552F0]"
          >
            <span className="truncate">
              {selectedMatName === "all" ? "ทั้งหมด (All)" : selectedMatName}
            </span>
            <span className="ml-2">▾</span>
          </button>

          {isMatNameOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="ค้นหาวัตถุดิบ..."
                  value={matNameSearch}
                  onChange={(e) => setMatNameSearch(e.target.value)}
                  className="w-full rounded-md border-gray-300 px-2 py-1 text-sm focus:border-[#1552F0] focus:ring focus:ring-[#1552F0]"
                />
              </div>
              <ul className="max-h-60 overflow-auto text-sm">
                <li
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedMatName === "all" ? "bg-blue-50 font-medium" : ""}`}
                  onClick={() => {
                    setSelectedMatName("all");
                    setIsMatNameOpen(false);
                  }}
                >
                  ทั้งหมด (All)
                </li>
                {filteredMatNames.length === 0 && (
                  <li className="px-3 py-2 text-gray-400">ไม่พบข้อมูล</li>
                )}
                {filteredMatNames.map(name => (
                  <li
                    key={name}
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedMatName === name ? "bg-blue-50 font-medium" : ""}`}
                    onClick={() => {
                      setSelectedMatName(name);
                      setIsMatNameOpen(false);
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
              <div className="border-t p-2 flex justify-end">
                <button
                  onClick={() => setMatNameSort(matNameSort === "asc" ? "desc" : "asc")}
                  className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {matNameSort === "asc" ? "A-Z ↓" : "Z-A ↑"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLineCards = () => {
    if (lineData.length === 0) return null;

    // Group by date
    const groupedByDate = lineData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {});

    const delayInfo = selectedDelayPeriod === 'dbs3'
      ? { label: 'ช่วงที่ 3', desc: 'ออกห้องเย็น → บรรจุเสร็จ', color: 'red' }
      : { label: 'ช่วงที่ 4', desc: 'เตรียมเสร็จ → บรรจุเสร็จ', color: 'orange' };

    return (
      <div className="space-y-8">
        {Object.entries(groupedByDate).map(([date, lines]) => (
          <div key={date} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" />
              วันที่: {date}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {lines.map((lineItem, idx) => {
                const delayPercent = selectedDelayPeriod === 'dbs3' ? lineItem.dbs3_delay : lineItem.dbs2_delay;
                const delayWeight = selectedDelayPeriod === 'dbs3' ? lineItem.dbs3_delay_weight : lineItem.dbs2_delay_weight;
                const delayCount = selectedDelayPeriod === 'dbs3' ? lineItem.count_dbs3_delay : lineItem.count_dbs2_delay;

                return (
                  <div
                    key={idx}
                    onClick={() => handleCardClick(lineItem)}
                    className={`${getPercentColor(lineItem.nonDelayPercent)} border-l-4 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-gray-600" />
                        <h4 className="text-lg font-bold text-gray-800">{lineItem.line}</h4>
                      </div>
                      {getPercentIcon(lineItem.nonDelayPercent)}
                    </div>

                    {/* Non-Delay Percentage */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-bold ${getPercentTextColor(lineItem.nonDelayPercent)}`}>
                          {lineItem.nonDelayPercent.toFixed(1)}
                        </span>
                        <span className="text-xl text-gray-600">%</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 mt-1">วัตถุดิบที่ไม่เกิดความล่าช้า</p>
                      <p className="text-xs text-gray-500 mt-1">({delayInfo.label}: {delayInfo.desc})</p>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">น้ำหนักรวม:</span>
                        <span className="text-sm font-semibold text-gray-800">
                          {(lineItem.total_weight / 1000).toFixed(2)} MT
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">จำนวนแบตช์:</span>
                        <span className="text-sm font-semibold text-gray-800">
                          {lineItem.count_total}
                        </span>
                      </div>
                    </div>

                    {/* Delay Info */}
                    <div className="mt-4 border-t pt-4">
                      <div className={`bg-white bg-opacity-60 rounded p-3 border-l-2 border-${delayInfo.color}-500`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-sm font-bold text-${delayInfo.color}-700`}>
                            {delayInfo.label} - Delay
                          </span>
                          <span className={`text-lg font-bold text-${delayInfo.color}-700`}>
                            {delayPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            น้ำหนัก: {(delayWeight / 1000).toFixed(2)} MT
                          </div>
                          <div className="text-xs text-gray-600">
                            จำนวนแบตช์: {delayCount}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Click hint */}
                    <div className="mt-4 text-xs text-center text-gray-500 italic">
                      คลิกเพื่อดูรายละเอียด
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDetailsTable = () => {
    if (!selectedLine || detailsTableData.length === 0) return null;

    const formatDateTime = (dateString) => {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    const statusField = selectedDelayPeriod === 'dbs3' ? 'dbs3_status' : 'dbs2_status';
    const hoursField = selectedDelayPeriod === 'dbs3' ? 'DBS3' : 'DBS2';
    const periodLabel = selectedDelayPeriod === 'dbs3' ? 'ช่วงที่ 3' : 'ช่วงที่ 4';

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            รายละเอียด: {selectedLine.line} - วันที่ {selectedLine.date} ({periodLabel})
          </h3>
          <button
            onClick={() => {
              setSelectedLine(null);
              setDetailsTableData([]);
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
          >
            ปิด
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mat Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">RM Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">น้ำหนัก (kg)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">เตรียมเสร็จ</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ออกห้องเย็น</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">บรรจุเสร็จ</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{periodLabel} (hr)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {detailsTableData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{row.mat_name || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.rm_type_name || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.weight_RM?.toFixed(2) || '0.00'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(row.rmit_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(row.out_cold_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(row.sc_pack_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row[hoursField]?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${row[statusField] === 'delay' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                      {row[statusField] || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          แสดงทั้งหมด {detailsTableData.length} รายการ
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (lineData.length === 0) return null;

    const totalWeight = lineData.reduce((sum, item) => sum + item.total_weight, 0);
    const selectedDelayWeight = selectedDelayPeriod === 'dbs3'
      ? lineData.reduce((sum, item) => sum + item.dbs3_delay_weight, 0)
      : lineData.reduce((sum, item) => sum + item.dbs2_delay_weight, 0);

    // Calculate weighted average based on total weight (not simple average)
    const selectedDelayPercent = totalWeight > 0 ? ((selectedDelayWeight / totalWeight) * 100) : 0;
    const avgNonDelay = 100 - selectedDelayPercent;

    const periodLabel = selectedDelayPeriod === 'dbs3' ? 'ช่วงที่ 3' : 'ช่วงที่ 4';
    const periodDesc = selectedDelayPeriod === 'dbs3' ? 'ออกห้องเย็น → บรรจุเสร็จ' : 'เตรียมเสร็จ → บรรจุเสร็จ';
    const periodColor = selectedDelayPeriod === 'dbs3' ? 'red' : 'orange';

    return (
      <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-6 rounded-lg shadow-md border-2 border-blue-300 mb-6">
        <h3 className="text-2xl font-bold mb-2 text-gray-800">📊 สรุปภาพรวมประสิทธิภาพการผลิต</h3>
        <p className="text-sm text-gray-600 mb-6">กำลังแสดงข้อมูล: {periodLabel} ({periodDesc})</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-lg shadow-md border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium mb-2">น้ำหนักรวมทั้งหมด</p>
            <p className="text-3xl font-bold text-blue-600">
              {(totalWeight / 1000).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">MT (เมตริกตัน)</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-md border-l-4 border-green-500">
            <p className="text-sm text-gray-600 font-medium mb-2">% ไม่ล่าช้าเฉลี่ย</p>
            <p className="text-3xl font-bold text-green-600">
              {avgNonDelay.toFixed(2)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">Non-Delay Average</p>
          </div>

          <div className={`bg-white p-5 rounded-lg shadow-md border-l-4 border-${periodColor}-500`}>
            <p className="text-sm text-gray-600 font-medium mb-2">{periodLabel} - Delay %</p>
            <p className={`text-3xl font-bold text-${periodColor}-600`}>
              {selectedDelayPercent.toFixed(2)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {(selectedDelayWeight / 1000).toFixed(2)} MT
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-md border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 font-medium mb-2">จำนวนไลน์ผลิต</p>
            <p className="text-3xl font-bold text-purple-600">
              {[...new Set(lineData.map(item => item.line))].length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Production Lines</p>
          </div>
        </div>

        <div className="mt-6 bg-white bg-opacity-50 p-4 rounded-lg">
          <div className="text-sm">
            <span className="text-gray-600">📅 จำนวนรายการทั้งหมด:</span>
            <span className="font-bold text-gray-800 ml-2">{lineData.length} รายการ</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        {renderFilterSection()}
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1552F0]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-6">
        {renderFilterSection()}
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">Error: {error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (lineData.length === 0) {
    return (
      <div className="p-4 space-y-6">
        {renderFilterSection()}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {startDate || endDate ? "ไม่พบข้อมูลในช่วงวันที่ที่เลือก" : "ไม่มีข้อมูล"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {startDate || endDate
                ? "กรุณาลองเลือกช่วงวันที่อื่น หรือกดรีเซ็ตเพื่อดูข้อมูลทั้งหมด"
                : "ไม่มีข้อมูลในระบบ"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
      {renderFilterSection()}
      {renderDelayPeriodSelector()}
      {renderSummary()}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🏭 กราฟแสดง % วัตถุดิบที่ไม่เกิดความล่าช้า
          </h2>
          <h3 className="text-lg text-gray-700 mb-2">
            Percentage of Non-Delayed Raw Materials
          </h3>
          <p className="text-sm text-gray-600">
            แสดงค่า % วัตถุดิบที่ไม่เกิดความล่าช้าของแต่ละไลน์การผลิต
          </p>
        </div>

        {renderLineCards()}
      </div>

      {renderDetailsTable()}
    </div>
  );
};

export default ProductionLineDelayDashboard;