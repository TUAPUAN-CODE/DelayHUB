import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Line, ComposedChart } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;

const ParentComponent = () => {
  const [chartData, setChartData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedRmType, setSelectedRmType] = useState('all');
  const [rmTypes, setRmTypes] = useState([]);
  const [selectedMatName, setSelectedMatName] = useState('all');
  const [matNames, setMatNames] = useState([]);
  const [matNameSort, setMatNameSort] = useState('asc');
  const [isOpen, setIsOpen] = useState(false);
  const [matNameSearch, setMatNameSearch] = useState("");
  const [isRmTypeOpen, setIsRmTypeOpen] = useState(false);
  const [rmTypeSearch, setRmTypeSearch] = useState("");
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'monthly' | 'yearly'

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

  // State for toggle buttons
  const [visibleDelays, setVisibleDelays] = useState({
    dcs: true,
    dbs1: true,
    dbs2: true,
    dbs3: true
  });

  // State for clicked bar details
  const [selectedDateDetails, setSelectedDateDetails] = useState(null);
  const [detailsTableData, setDetailsTableData] = useState([]);

  const formatDateForAPI = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getGroupKey = (dateString, mode) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (mode === 'yearly') return `${year}`;
    if (mode === 'monthly') return `${year}-${month}`;
    return `${year}-${month}-${day}`;
  };

  const processChartData = (data, rmTypeFilter, matNameFilter) => {
    let filteredData = data;

    if (rmTypeFilter !== 'all') {
      filteredData = filteredData.filter(item => item.rm_type_name === rmTypeFilter);
    }

    if (matNameFilter !== 'all') {
      filteredData = filteredData.filter(item => item.mat_name === matNameFilter);
    }

    const groupedByDate = {};

    filteredData.forEach(item => {
      const date = getGroupKey(item.rmit_date_fac, viewMode);

      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date: date,
          total_weight: 0,
          dcs_delay_weight: 0,
          dbs1_delay_weight: 0,
          dbs2_delay_weight: 0,
          dbs3_delay_weight: 0,
          dcs_normal_weight: 0,
          dbs1_normal_weight: 0,
          dbs2_normal_weight: 0,
          dbs3_normal_weight: 0
        };
      }

      const weight = item.weight_RM || 0;
      groupedByDate[date].total_weight += weight;

      if (item.dcs_status === 'delay') {
        groupedByDate[date].dcs_delay_weight += weight;
      } else {
        groupedByDate[date].dcs_normal_weight += weight;
      }

      if (item.dbs1_status === 'delay') {
        groupedByDate[date].dbs1_delay_weight += weight;
      } else {
        groupedByDate[date].dbs1_normal_weight += weight;
      }

      if (item.dbs2_status === 'delay') {
        groupedByDate[date].dbs2_delay_weight += weight;
      } else {
        groupedByDate[date].dbs2_normal_weight += weight;
      }

      if (item.dbs3_status === 'delay') {
        groupedByDate[date].dbs3_delay_weight += weight;
      } else {
        groupedByDate[date].dbs3_normal_weight += weight;
      }
    });

    const chartDataArray = Object.values(groupedByDate).map(item => {
      const dcsDelayPercent = item.total_weight > 0
        ? (item.dcs_delay_weight / item.total_weight) * 100
        : 0;
      const dbs1DelayPercent = item.total_weight > 0
        ? (item.dbs1_delay_weight / item.total_weight) * 100
        : 0;
      const dbs2DelayPercent = item.total_weight > 0
        ? (item.dbs2_delay_weight / item.total_weight) * 100
        : 0;
      const dbs3DelayPercent = item.total_weight > 0
        ? (item.dbs3_delay_weight / item.total_weight) * 100
        : 0;

      return {
        date: item.date,
        total_weight: item.total_weight,

        // DCS
        dcs_normal: 100 - dcsDelayPercent,
        dcs_delay: dcsDelayPercent,
        dcs_delay_weight: item.dcs_delay_weight,
        dcs_normal_weight: item.dcs_normal_weight,

        // DBS1
        dbs1_normal: 100 - dbs1DelayPercent,
        dbs1_delay: dbs1DelayPercent,
        dbs1_delay_weight: item.dbs1_delay_weight,
        dbs1_normal_weight: item.dbs1_normal_weight,

        // DBS2
        dbs2_normal: 100 - dbs2DelayPercent,
        dbs2_delay: dbs2DelayPercent,
        dbs2_delay_weight: item.dbs2_delay_weight,
        dbs2_normal_weight: item.dbs2_normal_weight,

        // DBS3
        dbs3_normal: 100 - dbs3DelayPercent,
        dbs3_delay: dbs3DelayPercent,
        dbs3_delay_weight: item.dbs3_delay_weight,
        dbs3_normal_weight: item.dbs3_normal_weight,
      };
    });

    chartDataArray.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate trend line (average of visible delay percentages)
    chartDataArray.forEach((item) => {
      let totalDelay = 0;
      let count = 0;

      if (visibleDelays.dcs) {
        totalDelay += item.dcs_delay;
        count++;
      }
      if (visibleDelays.dbs1) {
        totalDelay += item.dbs1_delay;
        count++;
      }
      if (visibleDelays.dbs2) {
        totalDelay += item.dbs2_delay;
        count++;
      }
      if (visibleDelays.dbs3) {
        totalDelay += item.dbs3_delay;
        count++;
      }

      item.avgDelay = count > 0 ? totalDelay / count : 0;
    });

    return chartDataArray;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.append('start_date', formatDateForAPI(startDate));
      if (endDate) params.append('end_date', formatDateForAPI(endDate));

      const response = await fetch(`${API_URL}/api/report/rm-delay?${params.toString()}`, {
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

        const processedData = processChartData(result.data, selectedRmType, selectedMatName);
        setChartData(processedData);
      } else {
        setRawData([]);
        setChartData([]);
        setRmTypes([]);
        setMatNames([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setRawData([]);
      setChartData([]);
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

      const processedData = processChartData(rawData, selectedRmType, selectedMatName);
      setChartData(processedData);
    }
  }, [selectedRmType, selectedMatName, matNameSort, rawData, visibleDelays, viewMode]);

  useEffect(() => {
    setSelectedDateDetails(null);
    setDetailsTableData([]);
  }, [viewMode]);

  const handleDateFilter = () => {
    fetchData();
  };

  const resetDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedRmType('all');
    setSelectedMatName('all');
    setMatNameSort('asc');
    setSelectedDateDetails(null);
    setDetailsTableData([]);
    fetchData();
  };

  const toggleDelay = (delayType) => {
    setVisibleDelays(prev => ({
      ...prev,
      [delayType]: !prev[delayType]
    }));
  };

  const handleBarClick = (data) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const clickedPeriod = data.activePayload[0].payload.date;
    setSelectedDateDetails(clickedPeriod);

    let filteredData = rawData.filter(item =>
      getGroupKey(item.rmit_date_fac, viewMode) === clickedPeriod
    );

    if (selectedRmType !== 'all') {
      filteredData = filteredData.filter(item => item.rm_type_name === selectedRmType);
    }
    if (selectedMatName !== 'all') {
      filteredData = filteredData.filter(item => item.mat_name === selectedMatName);
    }

    setDetailsTableData(filteredData);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{`${viewMode === 'yearly' ? 'ปี' : viewMode === 'monthly' ? 'เดือน' : 'วันที่'}: ${label}`}</p>
          <p className="text-sm text-gray-600 mb-2">{`น้ำหนักรวม: ${data.total_weight.toFixed(2)} kg`}</p>
          <div className="border-t pt-2 mt-2 space-y-1">
            {visibleDelays.dbs1 && (
              <>
                <p className="text-sm text-yellow-600 font-medium">
                  {`ช่วงที่ 1 Delay: ${(data.dbs1_delay_weight / 1000).toFixed(2)} MT (${data.dbs1_delay.toFixed(2)}%)`}
                </p>
                <p className="text-sm text-yellow-400">
                  {`ช่วงที่ 1 ปกติ: ${(data.dbs1_normal_weight / 1000).toFixed(2)} MT (${data.dbs1_normal.toFixed(2)}%)`}
                </p>
              </>
            )}
            {visibleDelays.dcs && (
              <>
                <p className="text-sm text-blue-600 font-medium">
                  {`ช่วงที่ 2 Delay: ${(data.dcs_delay_weight / 1000).toFixed(2)} MT (${data.dcs_delay.toFixed(2)}%)`}
                </p>
                <p className="text-sm text-blue-400">
                  {`ช่วงที่ 2 ปกติ: ${(data.dcs_normal_weight / 1000).toFixed(2)} MT (${data.dcs_normal.toFixed(2)}%)`}
                </p>
              </>
            )}
            {visibleDelays.dbs3 && (
              <>
                <p className="text-sm text-red-600 font-medium">
                  {`ช่วงที่ 3 Delay: ${(data.dbs3_delay_weight / 1000).toFixed(2)} MT (${data.dbs3_delay.toFixed(2)}%)`}
                </p>
                <p className="text-sm text-red-400">
                  {`ช่วงที่ 3 ปกติ: ${(data.dbs3_normal_weight / 1000).toFixed(2)} MT (${data.dbs3_normal.toFixed(2)}%)`}
                </p>
              </>
            )}
            {visibleDelays.dbs2 && (
              <>
                <p className="text-sm text-orange-600 font-medium">
                  {`ช่วงที่ 4 Delay: ${(data.dbs2_delay_weight / 1000).toFixed(2)} MT (${data.dbs2_delay.toFixed(2)}%)`}
                </p>
                <p className="text-sm text-orange-400">
                  {`ช่วงที่ 4 ปกติ: ${(data.dbs2_normal_weight / 1000).toFixed(2)} MT (${data.dbs2_normal.toFixed(2)}%)`}
                </p>
              </>
            )}
            <p className="text-sm text-purple-600 font-medium pt-2 border-t">
              {`ค่าเฉลี่ย Delay: ${data.avgDelay.toFixed(2)}%`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (value < 1) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="700"
      >
        {`${value.toFixed(1)}%`}
      </text>
    );
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

  const renderViewModeToggle = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-800">มุมมองกราฟ:</h3>
      <div className="flex gap-2">
        {[
          { key: 'daily', label: 'รายวัน' },
          { key: 'monthly', label: 'รายเดือน' },
          { key: 'yearly', label: 'รายปี' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${viewMode === key
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderDelayToggleButtons = () => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <h3 className="text-sm font-semibold mb-3 text-gray-800">เลือก Delay ที่ต้องการดู:</h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => toggleDelay('dbs1')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${visibleDelays.dbs1
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
        >
          Delay ช่วงที่ 1 <br />(เตรียมเสร็จ-เข้าห้องเย็น)
        </button>
        <button
          onClick={() => toggleDelay('dcs')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${visibleDelays.dcs
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
        >
          Delay ช่วงที่ 2 <br />(เข้าห้องเย็น-ออกห้องเย็น)
        </button>
        <button
          onClick={() => toggleDelay('dbs3')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${visibleDelays.dbs3
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
        >
          Delay ช่วงที่ 3 <br />(ออกห้องเย็น-บรรจุเสร็จ)
        </button>
        <button
          onClick={() => toggleDelay('dbs2')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${visibleDelays.dbs2
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
        >
          Delay ช่วงที่ 4 <br />(เตรียมเสร็จ-บรรจุเสร็จ)
        </button>
      </div>
    </div>
  );

  const renderDetailsTable = () => {
    if (!selectedDateDetails || detailsTableData.length === 0) return null;

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

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            รายละเอียดข้อมูล{viewMode === 'yearly' ? 'ปี' : viewMode === 'monthly' ? 'เดือน' : 'วันที่'}: {selectedDateDetails}
          </h3>
          <button
            onClick={() => {
              setSelectedDateDetails(null);
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mat Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RM Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">น้ำหนัก (kg)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMIT Date Fac</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เตรียมเสร็จ</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เข้าห้องเย็น</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ออกห้องเย็น</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บรรจุเสร็จ</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DCS</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS1</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS2</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS3</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DCS Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS1 Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS2 Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS3 Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {detailsTableData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{row.mat_name || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.rm_type_name || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.weight_RM?.toFixed(2) || '0.00'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.rmit_date_fac)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.rmit_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.come_cold_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.out_cold_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.sc_pack_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.dcs1?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.DBS1?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.DBS2?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.DBS3?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${row.dcs_status === 'delay' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {row.dcs_status || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${row.dbs1_status === 'delay' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {row.dbs1_status || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${row.dbs2_status === 'delay' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {row.dbs2_status || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${row.dbs3_status === 'delay' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {row.dbs3_status || '-'}
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

  const renderFilterSection = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">ตัวกรองข้อมูล</h2>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">กรองตามวันที่เตรียมเสร็จ (RMIT Date Fac)</h3>
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
              className="px-4 py-2 bg-[#4aaaec] text-white rounded-md hover:bg-[#3a92d4] focus:outline-none focus:ring-2 focus:ring-[#4aaaec] focus:ring-opacity-50 transition-colors"
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
            Showing data where RMIT Date Fac between:
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
              className="w-full flex justify-between items-center rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4aaaec]"
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
                    className="w-full rounded-md border-gray-300 px-2 py-1 text-sm focus:border-[#4aaaec] focus:ring focus:ring-[#4aaaec]"
                  />
                </div>
                <ul className="max-h-60 overflow-auto text-sm">
                  <li
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedRmType === "all" ? "bg-blue-50 font-medium" : ""}`}
                    onClick={() => { setSelectedRmType("all"); setIsRmTypeOpen(false); }}
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
                      onClick={() => { setSelectedRmType(type); setIsRmTypeOpen(false); }}
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
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex justify-between items-center rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4aaaec]"
          >
            <span className="truncate">
              {selectedMatName === "all" ? "ทั้งหมด (All)" : selectedMatName}
            </span>
            <span className="ml-2">▾</span>
          </button>
          {isOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="ค้นหาวัตถุดิบ..."
                  value={matNameSearch}
                  onChange={(e) => setMatNameSearch(e.target.value)}
                  className="w-full rounded-md border-gray-300 px-2 py-1 text-sm focus:border-[#4aaaec] focus:ring focus:ring-[#4aaaec]"
                />
              </div>
              <ul className="max-h-60 overflow-auto text-sm">
                <li
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedMatName === "all" ? "bg-blue-50 font-medium" : ""}`}
                  onClick={() => { setSelectedMatName("all"); setIsOpen(false); }}
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
                    onClick={() => { setSelectedMatName(name); setIsOpen(false); }}
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

  const renderSummary = () => {
    if (chartData.length === 0) return null;

    const totalWeight = chartData.reduce((sum, item) => sum + item.total_weight, 0);
    const totalDcsDelay = chartData.reduce((sum, item) => sum + item.dcs_delay_weight, 0);
    const totalDbs1Delay = chartData.reduce((sum, item) => sum + item.dbs1_delay_weight, 0);
    const totalDbs2Delay = chartData.reduce((sum, item) => sum + item.dbs2_delay_weight, 0);
    const totalDbs3Delay = chartData.reduce((sum, item) => sum + item.dbs3_delay_weight, 0);

    const dcsDelayPercent = totalWeight > 0 ? ((totalDcsDelay / totalWeight) * 100).toFixed(2) : 0;
    const dbs1DelayPercent = totalWeight > 0 ? ((totalDbs1Delay / totalWeight) * 100).toFixed(2) : 0;
    const dbs2DelayPercent = totalWeight > 0 ? ((totalDbs2Delay / totalWeight) * 100).toFixed(2) : 0;
    const dbs3DelayPercent = totalWeight > 0 ? ((totalDbs3Delay / totalWeight) * 100).toFixed(2) : 0;

    const dcsNormalPercent = (100 - parseFloat(dcsDelayPercent)).toFixed(2);
    const dbs1NormalPercent = (100 - parseFloat(dbs1DelayPercent)).toFixed(2);
    const dbs2NormalPercent = (100 - parseFloat(dbs2DelayPercent)).toFixed(2);
    const dbs3NormalPercent = (100 - parseFloat(dbs3DelayPercent)).toFixed(2);

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">สรุปภาพรวม</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">น้ำหนักรวมทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-600">
              {(totalWeight / 1000).toFixed(3)} MT
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">{viewMode === 'yearly' ? 'จำนวนปี' : viewMode === 'monthly' ? 'จำนวนเดือน' : 'จำนวนวัน'}</p>
            <p className="text-2xl font-bold text-gray-600">{chartData.length} {viewMode === 'yearly' ? 'ปี' : viewMode === 'monthly' ? 'เดือน' : 'วัน'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium">DCS Status</p>
            <div className="mt-2">
              <p className="text-lg font-bold text-blue-600">
                {(totalDcsDelay / 1000).toFixed(2)} MT
              </p>
              <p className="text-sm text-blue-500">Delay: {dcsDelayPercent}%</p>
              <p className="text-sm text-green-600">ปกติ: {dcsNormalPercent}%</p>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 font-medium">DBS1 Status</p>
            <div className="mt-2">
              <p className="text-lg font-bold text-yellow-600">
                {(totalDbs1Delay / 1000).toFixed(2)} MT
              </p>
              <p className="text-sm text-yellow-600">Delay: {dbs1DelayPercent}%</p>
              <p className="text-sm text-green-600">ปกติ: {dbs1NormalPercent}%</p>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 font-medium">DBS2 Status</p>
            <div className="mt-2">
              <p className="text-lg font-bold text-orange-600">
                {(totalDbs2Delay / 1000).toFixed(2)} MT
              </p>
              <p className="text-sm text-orange-600">Delay: {dbs2DelayPercent}%</p>
              <p className="text-sm text-green-600">ปกติ: {dbs2NormalPercent}%</p>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
            <p className="text-sm text-gray-600 font-medium">DBS3 Status</p>
            <div className="mt-2">
              <p className="text-lg font-bold text-red-600">
                {(totalDbs3Delay / 1000).toFixed(2)} MT
              </p>
              <p className="text-sm text-red-600">Delay: {dbs3DelayPercent}%</p>
              <p className="text-sm text-green-600">ปกติ: {dbs3NormalPercent}%</p>
            </div>
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#4aaaec]"></div>
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
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">Error: {error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="p-4 space-y-6">
        {renderFilterSection()}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="flex flex-col items-center justify-center py-12">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
    <div className="p-4 space-y-6">
      {renderFilterSection()}
      {renderViewModeToggle()}
      {renderDelayToggleButtons()}
      {renderSummary()}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          กราฟแสดง % วัตถุดิบที่เกิดความล่าช้า <br />
          Percentage of Delayed Raw Materials
          {selectedRmType !== 'all' && ` - RM Type: ${selectedRmType}`}
          {selectedMatName !== 'all' && ` - Mat: ${selectedMatName}`}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          * คลิกที่แท่งกราฟเพื่อดูรายละเอียดข้อมูล
        </p>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }} onClick={handleBarClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={120}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: 'เปอร์เซ็นต์ (%)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
              domain={[0, 10]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />

            {/* ✅ CHANGED: Now showing dbs1_delay instead of dbs1_normal */}
            {visibleDelays.dbs1 && (
              <Bar
                dataKey="dbs1_delay"
                stackId="dbs1"
                fill="#eab308"
                name="Delay ช่วงที่ 1 (เตรียมเสร็จ-เข้าห้องเย็น)"
                radius={[4, 4, 0, 0]}
                barSize={40}
                cursor="pointer"
              >
                <LabelList content={renderCustomLabel} />
              </Bar>
            )}

            {/* ✅ CHANGED: Now showing dcs_delay instead of dcs_normal */}
            {visibleDelays.dcs && (
              <Bar
                dataKey="dcs_delay"
                stackId="dcs"
                fill="#3b82f6"
                name="Delay ช่วงที่ 2 (เข้าห้องเย็น-ออกห้องเย็น)"
                radius={[4, 4, 0, 0]}
                barSize={40}
                cursor="pointer"
              >
                <LabelList content={renderCustomLabel} />
              </Bar>
            )}

            {/* ✅ CHANGED: Now showing dbs3_delay instead of dbs3_normal */}
            {visibleDelays.dbs3 && (
              <Bar
                dataKey="dbs3_delay"
                stackId="dbs3"
                fill="#ef4444"
                name="Delay ช่วงที่ 3 (ออกห้องเย็น-บรรจุเสร็จ)"
                radius={[4, 4, 0, 0]}
                barSize={40}
                cursor="pointer"
              >
                <LabelList content={renderCustomLabel} />
              </Bar>
            )}

            {/* ✅ CHANGED: Now showing dbs2_delay instead of dbs2_normal */}
            {visibleDelays.dbs2 && (
              <Bar
                dataKey="dbs2_delay"
                stackId="dbs2"
                fill="#f97316"
                name="Delay ช่วงที่ 4 (เตรียมเสร็จ-บรรจุเสร็จ)"
                radius={[4, 4, 0, 0]}
                barSize={40}
                cursor="pointer"
              >
                <LabelList content={renderCustomLabel} />
              </Bar>
            )}

            {/* Trend Line */}
            <Line
              type="monotone"
              dataKey="avgDelay"
              stroke="#00c317ff"
              strokeWidth={2}
              dot={{ fill: '#286100ff', r: 5 }}
              name="เส้นแนวโน้มค่าเฉลี่ย Delay"
              strokeDasharray="0 0"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {renderDetailsTable()}
    </div>
  );
};

export default ParentComponent;