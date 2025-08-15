import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n';

interface RequestData {
  requestId: string;
  companyName: string;
  status: string;
}

export default function AdminPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      const col = collection(db, 'requests');
      const q = filter === 'All' ? col : query(col, where('status', '==', filter));
      const snap = await getDocs(q);
      const items: RequestData[] = [];
      snap.forEach((doc) => items.push(doc.data() as RequestData));
      setRequests(items);
    };
    fetchData();
  }, [filter]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t.admin.title}</h1>
      <select className="border" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="All">All</option>
        <option value="Pending">Pending</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="border px-2">ID</th>
            <th className="border px-2">{t.form.companyName}</th>
            <th className="border px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.requestId}>
              <td className="border px-2">{r.requestId}</td>
              <td className="border px-2">{r.companyName}</td>
              <td className="border px-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
