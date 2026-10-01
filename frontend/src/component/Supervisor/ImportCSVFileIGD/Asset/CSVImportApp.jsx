import React, { useState } from 'react';
import { Upload, Save, AlertCircle, CheckCircle, X } from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL;

const ImportMatPkg = () => {
  const [rows, setRows] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [notification, setNotification] = useState({ type: '', message: '', show: false });

  const showNotification = (type, message) => {
    setNotification({ type, message, show: true });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      showNotification('error', 'ไฟล์ต้องมีข้อมูลอย่างน้อย 1 แถว (นอกจาก header)');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const pkgIdx = headers.indexOf('mat_pkg');
    const dctIdx = headers.indexOf('mat_pkg_dct');
    if (pkgIdx === -1) {
      showNotification('error', 'ไม่พบคอลัมน์ mat_pkg ในไฟล์ CSV');
      return;
    }
    const data = lines.slice(1).map((line, i) => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return { id: i, mat_pkg: vals[pkgIdx] || '', mat_pkg_dct: dctIdx !== -1 ? (vals[dctIdx] || '') : '' };
    }).filter(r => r.mat_pkg);
    setRows(data);
    showNotification('success', `อ่านไฟล์สำเร็จ พบข้อมูล ${data.length} แถว`);
  };

  const parseExcel = (buffer) => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (json.length === 0) {
      showNotification('error', 'ไม่พบข้อมูลในไฟล์');
      return;
    }
    if (!('mat_pkg' in json[0])) {
      showNotification('error', 'ไม่พบคอลัมน์ mat_pkg ในไฟล์ Excel');
      return;
    }
    const data = json.map((row, i) => ({
      id: i,
      mat_pkg: String(row.mat_pkg || '').trim(),
      mat_pkg_dct: String(row.mat_pkg_dct || '').trim(),
    })).filter(r => r.mat_pkg);
    setRows(data);
    showNotification('success', `อ่านไฟล์สำเร็จ พบข้อมูล ${data.length} แถว`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      showNotification('error', 'รองรับเฉพาะไฟล์ .csv, .xlsx, .xls');
      return;
    }
    setSelectedFile(file);
    setRows([]);
    setResult(null);

    const reader = new FileReader();
    if (ext === 'csv') {
      reader.onload = (ev) => parseCSV(ev.target.result);
      reader.readAsText(file);
    } else {
      reader.onload = (ev) => parseExcel(ev.target.result);
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSave = async () => {
    if (rows.length === 0) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_URL}/api/supervisor/mat-pkg/import`, {
        items: rows.map(r => ({ mat_pkg: r.mat_pkg, mat_pkg_dct: r.mat_pkg_dct })),
      });
      setResult(res.data);
      showNotification('success', `บันทึกสำเร็จ ${res.data.saved} แถว | ข้าม ${res.data.skipped} แถว (ซ้ำ)`);
      setRows([]);
      setSelectedFile(null);
    } catch (err) {
      showNotification('error', 'เกิดข้อผิดพลาด: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Notification */}
      {notification.show && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {notification.message}
          </div>
          <button onClick={() => setNotification(p => ({ ...p, show: false }))}><X size={16} /></button>
        </div>
      )}

      {/* Upload zone */}
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">นำเข้าข้อมูล Material Package</h2>
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
          <Upload className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="pkgFile"
          />
          <label htmlFor="pkgFile" className="cursor-pointer">
            <span className="text-blue-600 hover:text-blue-800 font-semibold text-base">เลือกไฟล์</span>
            <span className="text-gray-500 text-sm"> (.csv / .xlsx / .xls)</span>
          </label>
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              ไฟล์: <span className="font-medium">{selectedFile.name}</span>
            </p>
          )}
        </div>
        <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          โครงสร้างไฟล์: ต้องมีคอลัมน์ <code className="bg-gray-200 px-1 rounded">mat_pkg</code> และ <code className="bg-gray-200 px-1 rounded">mat_pkg_dct</code> — ข้อมูลซ้ำกับ database จะถูกข้ามอัตโนมัติ
        </div>
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              ตัวอย่างข้อมูล <span className="text-blue-600">({rows.length} แถว)</span>
            </h2>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
            >
              <Save size={15} />
              {isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>

          <div className="overflow-auto max-h-96 rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-600 text-white sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left w-12 font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">mat_pkg</th>
                  <th className="px-4 py-2 text-left font-medium">mat_pkg_dct</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-gray-800">{row.mat_pkg}</td>
                    <td className="px-4 py-2 text-gray-600">{row.mat_pkg_dct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-sm text-green-800">
          <div className="font-semibold mb-2 text-base">ผลการบันทึก</div>
          <div className="flex gap-6">
            <div>✅ บันทึกสำเร็จ: <span className="font-bold text-lg">{result.saved}</span> แถว</div>
            <div>⏭️ ข้ามซ้ำ: <span className="font-bold text-lg">{result.skipped}</span> แถว</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportMatPkg;
