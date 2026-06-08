import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle } from 'lucide-react';

const Table = ({ data }) => {
  const [selectedTimeRanges, setSelectedTimeRanges] = useState({});
  const [selectedLine, setSelectedLine] = useState(null);

  if (!data) return <div className="text-gray-600 p-4">No data available</div>;

  // Initialize selected time ranges
  useMemo(() => {
    if (data.delayDistribution && Object.keys(selectedTimeRanges).length === 0) {
      const ranges = {};
      data.delayDistribution.data.forEach((row) => {
        ranges[row[0]] = true;
      });
      setSelectedTimeRanges(ranges);
    }
  }, [data]);

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

  // Calculate RFT (Right First Time) metrics
  const calculateRFT = () => {
    // Total items
    const totalColdToPack = data.summary[0].values[2]; // Total for stage 3
    const totalPrepToPack = data.summary[0].values[3]; // Total for stage 4

    // Items within acceptable time (first time range - assuming this is target)
    const onTimeColdToPack = data.delayDistribution.data[0]?.[3] || 0;
    const onTimePrepToPack = data.delayDistribution.data[0]?.[4] || 0;

    return {
      stage3: {
        total: totalColdToPack,
        onTime: onTimeColdToPack,
        rft: totalColdToPack > 0 ? (onTimeColdToPack / totalColdToPack) * 100 : 0
      },
      stage4: {
        total: totalPrepToPack,
        onTime: onTimePrepToPack,
        rft: totalPrepToPack > 0 ? (onTimePrepToPack / totalPrepToPack) * 100 : 0
      }
    };
  };

  const rftMetrics = calculateRFT();

  // Generate trend data for stages 3 and 4 only
  const trendData = useMemo(() => {
    if (!data.delayDistribution) return [];
    
    return data.delayDistribution.data
      .filter((row) => selectedTimeRanges[row[0]])
      .map((row) => ({
        range: row[0],
        stage3: row[3] || 0,  // ออกห้องเย็น→บรรจุเสร็จ
        stage4: row[4] || 0   // เตรียม→บรรจุเสร็จ
      }));
  }, [data, selectedTimeRanges]);

  // Production line summary cards data
  const productionLines = [
    {
      id: 1,
      name: 'Can D',
      stage3RFT: rftMetrics.stage3.rft,
      stage4RFT: rftMetrics.stage4.rft,
      totalItems: Math.round(data.summary[0].values[0]),
      status: rftMetrics.stage4.rft >= 80 ? 'excellent' : rftMetrics.stage4.rft >= 60 ? 'good' : 'needs-improvement',
      avgStage3Time: data.summary[2].values[2],
      avgStage4Time: data.summary[2].values[3]
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'bg-gradient-to-br from-green-500 to-emerald-600';
      case 'good': return 'bg-gradient-to-br from-blue-500 to-cyan-600';
      case 'needs-improvement': return 'bg-gradient-to-br from-orange-500 to-amber-600';
      default: return 'bg-gradient-to-br from-gray-500 to-slate-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="w-6 h-6" />;
      case 'good': return <TrendingUp className="w-6 h-6" />;
      case 'needs-improvement': return <AlertTriangle className="w-6 h-6" />;
      default: return <Minus className="w-6 h-6" />;
    }
  };

  const RFTGauge = ({ percentage, label, size = 'large' }) => {
    const radius = size === 'large' ? 45 : 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    const getColor = (pct) => {
      if (pct >= 80) return '#10b981';
      if (pct >= 60) return '#3b82f6';
      return '#f59e0b';
    };

    return (
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size === 'large' ? 120 : 90, height: size === 'large' ? 120 : 90 }}>
          <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={getColor(percentage)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`font-bold ${size === 'large' ? 'text-2xl' : 'text-xl'}`} style={{ color: getColor(percentage) }}>
                {percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
        <div className={`mt-2 text-center ${size === 'large' ? 'text-sm' : 'text-xs'} text-gray-600 font-medium`}>
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Production Line Performance Dashboard
        </h2>
        <p className="text-gray-600">
          ประเภทวัตถุดิบ: <span className="font-semibold text-blue-600">{data.metadata.groupName}</span>
        </p>
      </div>

      {/* Production Line Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {productionLines.map((line) => (
          <div
            key={line.id}
            className={`${getStatusColor(line.status)} rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-102 hover:shadow-3xl cursor-pointer`}
            onClick={() => setSelectedLine(line.id === selectedLine ? null : line.id)}
          >
            {/* Card Header */}
            <div className="bg-white bg-opacity-95 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`${getStatusColor(line.status)} rounded-full p-3 text-white shadow-lg`}>
                    {getStatusIcon(line.status)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">สายการผลิต {line.name}</h3>
                    <p className="text-sm text-gray-600">ข้อมูล: {data.metadata.rmType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">{line.totalItems}</div>
                  <div className="text-sm text-gray-600">รายการทั้งหมด</div>
                </div>
              </div>

              {/* RFT Metrics */}
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
                  <RFTGauge 
                    percentage={line.stage3RFT} 
                    label="ออกห้องเย็น → บรรจุเสร็จ"
                    size="large"
                  />
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">เวลาเฉลี่ย:</span>
                      <span className="font-semibold text-gray-800">{line.avgStage3Time.toFixed(1)} ชม.</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ทันเวลา:</span>
                      <span className="font-semibold text-green-600">{Math.round(rftMetrics.stage3.onTime)} รายการ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ล่าช้า:</span>
                      <span className="font-semibold text-orange-600">
                        {Math.round(rftMetrics.stage3.total - rftMetrics.stage3.onTime)} รายการ
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                  <RFTGauge 
                    percentage={line.stage4RFT} 
                    label="เตรียมเสร็จ → บรรจุเสร็จ"
                    size="large"
                  />
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">เวลาเฉลี่ย:</span>
                      <span className="font-semibold text-gray-800">{line.avgStage4Time.toFixed(1)} ชม.</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ทันเวลา:</span>
                      <span className="font-semibold text-green-600">{Math.round(rftMetrics.stage4.onTime)} รายการ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ล่าช้า:</span>
                      <span className="font-semibold text-orange-600">
                        {Math.round(rftMetrics.stage4.total - rftMetrics.stage4.onTime)} รายการ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-6 flex justify-center">
                <div className={`inline-flex items-center px-6 py-3 rounded-full ${
                  line.status === 'excellent' ? 'bg-green-100 text-green-800' :
                  line.status === 'good' ? 'bg-blue-100 text-blue-800' :
                  'bg-orange-100 text-orange-800'
                } font-semibold text-sm shadow-md`}>
                  {line.status === 'excellent' && '🏆 ประสิทธิภาพยอดเยี่ยม'}
                  {line.status === 'good' && '👍 ประสิทธิภาพดี'}
                  {line.status === 'needs-improvement' && '⚠️ ต้องปรับปรุง'}
                </div>
              </div>
            </div>

            {/* Expandable Details */}
            {selectedLine === line.id && (
              <div className="bg-white bg-opacity-95 border-t-2 border-gray-200 p-6 animate-fadeIn">
                <h4 className="text-lg font-bold text-gray-800 mb-4">📊 รายละเอียดตามช่วงเวลา</h4>
                
                {/* Time Distribution Chart */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="range" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="stage3" fill="#3b82f6" name="ออกห้องเย็น → บรรจุเสร็จ" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="stage4" fill="#8b5cf6" name="เตรียมเสร็จ → บรรจุเสร็จ" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                        <th className="border border-gray-300 px-4 py-3 text-left">ช่วงเวลา</th>
                        <th className="border border-gray-300 px-4 py-3 text-center">ออกห้องเย็น → บรรจุเสร็จ</th>
                        <th className="border border-gray-300 px-4 py-3 text-center">เตรียมเสร็จ → บรรจุเสร็จ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.delayDistribution.data
                        .filter((row) => selectedTimeRanges[row[0]])
                        .map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-4 py-3 font-medium">{row[0]} ชม.</td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <span className="font-semibold">{Math.round(row[3])}</span>
                                <span className="text-xs text-gray-500">
                                  ({((row[3] / rftMetrics.stage3.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <span className="font-semibold">{Math.round(row[4])}</span>
                                <span className="text-xs text-gray-500">
                                  ({((row[4] / rftMetrics.stage4.total) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Time Range Filter */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">🔍 กรองตามช่วงเวลา</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllTimeRanges}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-md"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={deselectAllTimeRanges}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium shadow-md"
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md ${
                  selectedTimeRanges[range]
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {range} ชม.
              </button>
            );
          })}
        </div>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
            📈 แนวโน้มการกระจายของ Delay
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
              <YAxis label={{ value: 'จำนวน (รายการ)', angle: -90, position: 'insideLeft' }} />
              <RechartsTooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="stage3" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ r: 5, fill: '#3b82f6' }}
                activeDot={{ r: 7 }}
                name="ออกห้องเย็น → บรรจุเสร็จ"
              />
              <Line 
                type="monotone" 
                dataKey="stage4" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ r: 5, fill: '#8b5cf6' }}
                activeDot={{ r: 7 }}
                name="เตรียมเสร็จ → บรรจุเสร็จ"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="mt-6 bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
          📋 สรุปสถิติ
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <tbody>
              {data.summary.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-200 px-6 py-3 font-medium text-gray-700">{row.label}</td>
                  <td className="border border-gray-200 px-6 py-3 text-center">
                    {row.label === "N" ? Math.round(row.values[2]) : 
                     typeof row.values[2] === 'number' ? row.values[2].toFixed(1) : row.values[2]}
                  </td>
                  <td className="border border-gray-200 px-6 py-3 text-center">
                    {row.label === "N" ? Math.round(row.values[3]) : 
                     typeof row.values[3] === 'number' ? row.values[3].toFixed(1) : row.values[3]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md p-4 border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
          <div>
            <span className="font-semibold text-blue-600">📦 Group:</span> {data.metadata.groupName}
          </div>
          <div>
            <span className="font-semibold text-blue-600">🏷️ Type:</span> {data.metadata.rmType}
          </div>
          <div>
            <span className="font-semibold text-blue-600">📊 Sample Size:</span> {data.metadata.sampleSize}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;