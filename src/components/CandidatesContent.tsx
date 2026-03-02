import { Candidate } from '../types';
import { Edit3, Trash2, UserPlus } from 'lucide-react';

interface CandidatesContentProps {
  candidates: Candidate[];
  setShowCandidateModal: (show: boolean) => void;
  setEditingCandidate: (candidate: Candidate | null) => void;
  setShowDeleteCandidateModal: (show: boolean) => void;
  setCandidateToDelete: (candidate: Candidate | null) => void;
  fetchAllCandidates: () => Promise<void>;
}

export default function CandidatesContent({
  candidates,
  setShowCandidateModal,
  setEditingCandidate,
  setShowDeleteCandidateModal,
  setCandidateToDelete,
  fetchAllCandidates,
}: CandidatesContentProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Kelola Kandidat</h2>
          <p className="text-sm text-slate-500">Total {candidates.length} kandidat terdaftar</p>
        </div>
        <button
          onClick={() => {
            setEditingCandidate(null);
            setShowCandidateModal(true);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
        >
          <UserPlus className="w-4 h-4" /> Tambah Kandidat
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kandidat</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Deskripsi</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Suara</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {candidates.map(candidate => (
              <tr key={candidate.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img className="h-12 w-12 rounded-xl object-cover ring-2 ring-white shadow-sm" src={candidate.avatar} alt={candidate.name} referrerPolicy="no-referrer" />
                    <div className="ml-4">
                      <div className="text-sm font-bold text-slate-900">{candidate.name}</div>
                      <div className="text-xs text-slate-500 md:hidden truncate max-w-[150px]">{candidate.vision}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell max-w-xs truncate">{candidate.vision}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
                      {candidate.vote_count || 0}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingCandidate(candidate);
                        setShowCandidateModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Kandidat"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setCandidateToDelete(candidate);
                        setShowDeleteCandidateModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Hapus Kandidat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <UserPlus className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 font-medium">Tidak ada kandidat ditemukan</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
