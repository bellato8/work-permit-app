// ======================================================================
// File: web/src/components/CsvColumnSelector.tsx
// Purpose: Modal สำหรับเลือกคอลัมน์ที่จะส่งออกใน CSV
// ======================================================================

import React from "react";

export type CsvColumn = {
  key: string;
  label: string;
  enabled: boolean;
};

type Props = {
  columns: CsvColumn[];
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function CsvColumnSelector({
  columns,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            เลือกคอลัมน์ที่ต้องการส่งออก
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            เลือกข้อมูลที่ต้องการแสดงในไฟล์ CSV
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => onToggle(col.key)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              เลือกทั้งหมด
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={onDeselectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ยกเลิกทั้งหมด
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              ส่งออก CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

