import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { Target, Award, Users, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

interface MobileObjectivesProps {
  userRole: string;
}

export default function MobileObjectives({ userRole }: MobileObjectivesProps) {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedObj, setExpandedObj] = useState<Record<string, boolean>>({});

  const fetchObjectives = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/objectives');
      setObjectives(data || []);
      // Expand first objective by default
      if (data && data.length > 0) {
        setExpandedObj({ [data[0].id]: true });
      }
    } catch (err) {
      console.error('Failed to load objectives:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedObj(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-rose-500';
    if (percent < 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getProgressTextColor = (percent: number) => {
    if (percent < 50) return 'text-rose-600';
    if (percent < 80) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <div className="space-y-4 pb-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : objectives.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs py-10">
          Chưa có chiến dịch mục tiêu nào được lập
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map(obj => {
            const isOpen = expandedObj[obj.id];
            
            // Calculate overall progress of KRs
            const krs = obj.key_results || [];
            const totalProgress = krs.reduce((acc: number, curr: any) => acc + (curr.current_progress || 0), 0);
            const totalTarget = krs.reduce((acc: number, curr: any) => acc + (curr.target_value || 100), 0);
            const overallPercent = totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0;

            return (
              <div 
                key={obj.id}
                className="bg-white rounded-xl border border-slate-200/50 shadow-3xs overflow-hidden"
              >
                {/* Header card click to expand */}
                <div 
                  onClick={() => toggleExpand(obj.id)}
                  className="p-4 cursor-pointer active:bg-slate-50/80 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gold-50 text-gold-700 rounded-lg">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">{obj.title}</h4>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-bold uppercase mt-1 inline-block">
                          {obj.status === 'active' ? 'Đang chạy' : 'Hoàn tất'}
                        </span>
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>

                  {/* Progress bar summary */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                      <span>Tiến độ chiến dịch</span>
                      <span className={getProgressTextColor(overallPercent)}>{overallPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all ${getProgressColor(overallPercent)}`}
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sub KRs list details */}
                {isOpen && (
                  <div className="bg-slate-50/50 border-t border-slate-100 p-4 space-y-4">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mục tiêu then chốt (Key Results)</p>
                    
                    {krs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-2">Chưa khai báo KRs nào</p>
                    ) : (
                      <div className="space-y-3">
                        {krs.map((kr: any) => {
                          const percent = kr.target_value > 0 ? Math.round((kr.current_progress / kr.target_value) * 100) : 0;
                          return (
                            <div key={kr.id} className="bg-white p-3 rounded-lg border border-slate-200/50 shadow-2xs space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-[11px] font-bold text-slate-700 leading-snug">{kr.title}</span>
                                <span className={`text-[9px] font-mono font-bold shrink-0 ${getProgressTextColor(percent)}`}>
                                  {kr.current_progress}/{kr.target_value}
                                </span>
                              </div>

                              <div className="w-full bg-slate-100 rounded-full h-1">
                                <div 
                                  className={`h-1 rounded-full transition-all ${getProgressColor(percent)}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-semibold">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  {kr.user_name || 'Chưa nhận'}
                                </span>
                                <span>{kr.dept_name || 'Hệ thống'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
