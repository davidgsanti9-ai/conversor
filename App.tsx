import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CURRENCIES } from './constants';
import { ExchangeRates, SavedConversion } from './types';
import { DuoButton } from './components/DuoButton';

type Tab = 'inicio' | 'favoritos' | 'ajustes';
type TimeRange = '1D' | '5D' | '1M' | '6M' | '1A' | '6A' | 'TODO';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
  const [amount, setAmount] = useState<number>(1);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  
  const [rates, setRates] = useState<ExchangeRates>({});
  const [lastUpdate, setLastUpdate] = useState<{ date: string; time: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [newFavsCount, setNewFavsCount] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const [favorites, setFavorites] = useState<SavedConversion[]>(() => {
    const saved = localStorage.getItem('duo_favorites_local');
    return saved ? JSON.parse(saved) : [];
  });

  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [historyData, setHistoryData] = useState<{ date: string; rate: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    localStorage.setItem('duo_favorites_local', JSON.stringify(favorites));
  }, [favorites]);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      if (data.result === "success" && data.rates) {
        setRates(data.rates);
        const dateObj = new Date(data.time_last_update_unix * 1000);
        setLastUpdate({
          date: dateObj.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
          time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    } catch (error) {
      console.error("Failed to fetch rates:", error);
    } finally {
      setLoading(false);
    }
  }, [fromCurrency]);

  const fetchHistory = useCallback(async () => {
    if (fromCurrency === toCurrency) {
      setHistoryData([]);
      return;
    }
    setLoadingHistory(true);
    setHoveredIndex(null);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      let startDate = new Date();
      
      switch (timeRange) {
        case '1D': startDate.setDate(startDate.getDate() - 3); break;
        case '5D': startDate.setDate(startDate.getDate() - 8); break;
        case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
        case '6M': startDate.setMonth(startDate.getMonth() - 6); break;
        case '1A': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case '6A': startDate.setFullYear(startDate.getFullYear() - 6); break;
        case 'TODO': startDate = new Date('1999-01-01'); break;
      }
      
      const startStr = startDate.toISOString().split('T')[0];
      const res = await fetch(`https://api.frankfurter.app/${startStr}..${endDate}?from=${fromCurrency}&to=${toCurrency}`);
      const data = await res.json();
      
      if (data.rates) {
        const formatted = Object.entries(data.rates).map(([date, rate]: [string, any]) => ({
          date,
          rate: rate[toCurrency]
        }));
        setHistoryData(formatted);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [fromCurrency, toCurrency, timeRange]);

  useEffect(() => { fetchRates(); }, [fetchRates]);
  useEffect(() => {
    if (activeTab === 'inicio') fetchHistory();
    if (activeTab === 'favoritos') setNewFavsCount(0);
  }, [fetchHistory, activeTab]);

  const convertedAmount = rates[toCurrency] ? (amount * rates[toCurrency]).toFixed(2) : '0.00';

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleSaveToFavorites = () => {
    const alreadyExists = favorites.find(f => f.amount === amount && f.from === fromCurrency && f.to === toCurrency);
    if (alreadyExists) {
      showToast('¡Ya está en favoritos!', 'warning');
      return;
    }
    const fromFlag = CURRENCIES.find(c => c.code === fromCurrency)?.flag || '🏳️';
    const toFlag = CURRENCIES.find(c => c.code === toCurrency)?.flag || '🏳️';
    const newFav: SavedConversion = { id: Date.now().toString(), amount, from: fromCurrency, to: toCurrency, fromFlag, toFlag };
    setFavorites(prev => [newFav, ...prev]);
    setNewFavsCount(prev => prev + 1);
    showToast('¡Guardado con éxito!', 'success');
  };

  const showToast = (message: string, type: 'success' | 'warning' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSelectFavorite = (fav: SavedConversion) => {
    setAmount(fav.amount);
    setFromCurrency(fav.from);
    setToCurrency(fav.to);
    setActiveTab('inicio');
  };

  const removeFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current || historyData.length < 2) return;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    if ('touches' in e) {
      pt.x = e.touches[0].clientX; pt.y = e.touches[0].clientY;
    } else {
      pt.x = e.clientX; pt.y = e.clientY;
    }
    const cursor = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const chartPadding = { left: 10, right: 60 };
    const effectiveWidth = 400 - chartPadding.left - chartPadding.right;
    let relativeX = cursor.x - chartPadding.left;
    if (relativeX < 0) relativeX = 0;
    if (relativeX > effectiveWidth) relativeX = effectiveWidth;
    const index = Math.round((relativeX / effectiveWidth) * (historyData.length - 1));
    setHoveredIndex(index);
  };

  const renderChart = useMemo(() => {
    if (loadingHistory) return <div className="h-56 flex items-center justify-center"><div className="animate-bounce flex space-x-2"><div className="w-3 h-3 bg-[#58cc02] rounded-full"></div><div className="w-3 h-3 bg-[#58cc02] rounded-full animation-delay-200"></div><div className="w-3 h-3 bg-[#58cc02] rounded-full animation-delay-400"></div></div></div>;
    if (historyData.length < 2) return <div className="h-56 flex items-center justify-center text-[#afafaf] font-bold">Sin datos históricos suficientes</div>;
    const ratesValues = historyData.map(d => d.rate);
    const min = Math.min(...ratesValues), max = Math.max(...ratesValues), range = max - min || 1;
    const chartPadding = { top: 20, right: 60, bottom: 40, left: 10 }, width = 400, height = 240;
    const effectiveWidth = width - chartPadding.left - chartPadding.right, effectiveHeight = height - chartPadding.top - chartPadding.bottom;
    const pointsArray = historyData.map((d, i) => ({
      x: chartPadding.left + (i / (historyData.length - 1)) * effectiveWidth,
      y: height - chartPadding.bottom - ((d.rate - min) / range) * effectiveHeight
    }));
    const points = pointsArray.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${points} ${width - chartPadding.right},${height - chartPadding.bottom} ${chartPadding.left},${height - chartPadding.bottom}`;
    const focusX = hoveredIndex !== null ? pointsArray[hoveredIndex].x : 0;
    const focusY = hoveredIndex !== null ? pointsArray[hoveredIndex].y : 0;
    const showBelow = focusY < 110;
    return (
      <div className="relative w-full select-none">
        {hoveredIndex !== null && (
          <div className={`absolute pointer-events-none z-[100] transition-all duration-100 shadow-2xl border-2 rounded-2xl p-3 min-w-[150px] flex flex-col items-center backdrop-blur-sm ${isDarkMode ? 'bg-[#1b2e35]/95 border-[#3c444d]' : 'bg-white/95 border-[#e5e5e5]'}`} style={{ left: `${(focusX / 400) * 100}%`, top: `${(focusY / 240) * 100}%`, transform: `translate(${focusX > 200 ? '-95%' : '-5%'}, ${showBelow ? '25px' : '-115%'})` }}>
            <p className="text-[10px] font-black text-[#afafaf] uppercase tracking-wider mb-1 whitespace-nowrap">{new Date(historyData[hoveredIndex].date).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            <span className="text-xl font-black text-[#58cc02]">{historyData[hoveredIndex].rate.toFixed(4)}</span>
          </div>
        )}
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair touch-none overflow-visible" onMouseMove={handleMouseMove} onTouchMove={handleMouseMove} onMouseLeave={() => setHoveredIndex(null)} onTouchEnd={() => setHoveredIndex(null)}>
          <defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#58cc02" stopOpacity="0.3" /><stop offset="100%" stopColor="#58cc02" stopOpacity="0" /></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2"/></filter></defs>
          <line x1={chartPadding.left} y1={chartPadding.top} x2={width - chartPadding.right} y2={chartPadding.top} stroke={isDarkMode ? "#3c444d" : "#e5e5e5"} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4" />
          <line x1={chartPadding.left} y1={height - chartPadding.bottom} x2={width - chartPadding.right} y2={height - chartPadding.bottom} stroke={isDarkMode ? "#3c444d" : "#e5e5e5"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={width - 55} y={chartPadding.top + 5} className="text-[10px] font-black" fill="#afafaf">{max.toFixed(4)}</text>
          <text x={width - 55} y={height - chartPadding.bottom + 5} className="text-[10px] font-black" fill="#afafaf">{min.toFixed(4)}</text>
          <polyline fill="url(#chartGradient)" points={areaPoints} />
          <polyline fill="none" stroke="#58cc02" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" points={points} />
          {hoveredIndex !== null && <g>
            <line x1={focusX} y1={chartPadding.top} x2={focusX} y2={height - chartPadding.bottom} stroke="#58cc02" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4" />
            <circle cx={focusX} cy={focusY} r="7" fill="#58cc02" stroke="white" strokeWidth="2.5" vectorEffect="non-scaling-stroke" filter="url(#shadow)" />
          </g>}
        </svg>
      </div>
    );
  }, [historyData, loadingHistory, isDarkMode, hoveredIndex]);

  const QuickTable = ({ className = "" }: { className?: string }) => {
    const values = [1, 5, 10, 50, 100];
    const rate = rates[toCurrency] || 0;
    return (
      <div className={`rounded-3xl border-2 p-6 transition-colors h-fit ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'} ${className}`}>
        <h3 className="text-xs font-black text-[#afafaf] uppercase tracking-widest mb-4">Conversiones Rápidas</h3>
        <div className="grid gap-2">
          {values.map(val => (
            <div key={val} className="flex justify-between items-center border-b last:border-0 pb-2 border-dashed border-gray-200">
              <span className="font-black text-[#afafaf]">{val} {fromCurrency}</span>
              <span className="font-black text-[#58cc02]">{(val * rate).toFixed(2)} {toCurrency}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const NavButton = ({ tab, icon, color, label }: { tab: Tab, icon: React.ReactNode, color: string, label: string }) => (
    <button 
      onClick={() => setActiveTab(tab)} 
      className={`flex md:flex-row flex-col items-center gap-3 p-3 md:px-6 md:py-4 transition-all w-full md:rounded-2xl ${activeTab === tab ? 'scale-105 md:bg-gray-100 md:dark:bg-white/5' : 'opacity-50 hover:opacity-100'}`}
    >
      <div className={`p-2 rounded-xl transition-colors ${activeTab === tab ? `bg-[${color}]` : 'bg-transparent'}`}>
        <div className={`w-6 h-6 ${activeTab === tab ? 'text-white' : 'text-[#afafaf]'}`}>{icon}</div>
      </div>
      <span className={`text-[10px] md:text-sm font-black uppercase md:capitalize tracking-tighter md:tracking-normal ${activeTab === tab ? `text-[${color}] md:text-current` : 'text-[#afafaf]'}`}>{label}</span>
      {tab === 'favoritos' && newFavsCount > 0 && activeTab !== 'favoritos' && (
        <div className="absolute top-2 right-2 md:relative md:top-0 md:right-0 bg-[#1cb0f6] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{newFavsCount}</div>
      )}
    </button>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col md:flex-row ${isDarkMode ? "bg-[#131f24] text-white" : "bg-white text-[#4b4b4b]"}`}>
      
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 duration-300">
          <div className={`${toast.type === 'success' ? 'bg-[#58cc02] border-[#46a302]' : toast.type === 'error' ? 'bg-[#ff4b4b] border-[#d33131]' : 'bg-[#1cb0f6] border-[#1899d6]'} text-white px-8 py-4 rounded-2xl font-black flex items-center gap-4 shadow-xl border-b-4`}>
            <span>{toast.type === 'success' ? '✨' : toast.type === 'error' ? '🚫' : 'ℹ️'}</span>
            <span className="tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col w-64 h-screen sticky top-0 border-r-2 p-4 gap-4 ${isDarkMode ? 'border-[#3c444d]' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3 px-2 py-6 mb-4">
          <div className="bg-[#58cc02] p-2 rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-xl font-black tracking-tight">Conversor</h1>
        </div>
        
        <NavButton tab="inicio" label="Inicio" color="#58cc02" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
        <NavButton tab="favoritos" label="Favoritos" color="#ff9600" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>} />
        <NavButton tab="ajustes" label="Ajustes" color="#1cb0f6" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center p-4 md:p-12 pb-24 md:pb-12 max-w-screen-xl mx-auto w-full">
        
        {/* Mobile Header */}
        <header className="md:hidden w-full flex items-center justify-start mb-8 pb-4 border-b-2 dark:border-[#3c444d] border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-[#58cc02] p-2 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight">ConversorMoneda</h1>
          </div>
        </header>

        <div className={`w-full ${activeTab === 'inicio' ? 'md:grid md:grid-cols-3 gap-8 items-start' : 'max-w-2xl'}`}>
          
          <div className={`${activeTab === 'inicio' ? 'md:col-span-2' : ''} space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700`}>
            
            {activeTab === 'inicio' && (
              <>
                <div className={`relative rounded-3xl border-2 p-6 space-y-6 shadow-sm transition-colors ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`}>
                  <button onClick={handleSaveToFavorites} className={`absolute top-4 right-4 p-2 rounded-xl border-2 transition-all active:translate-y-1 active:border-b-0 shadow-sm ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d] hover:bg-[#3c444d]' : 'bg-white border-[#e5e5e5] hover:bg-[#f7f7f7]'}`}>⭐</button>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-[#afafaf] uppercase tracking-widest ml-1">Origen:</label>
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-transparent focus-within:border-[#1cb0f6] transition-all overflow-hidden ${isDarkMode ? 'bg-[#131f24]' : 'bg-[#f7f7f7]'}`}>
                      <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="bg-transparent font-black text-lg outline-none cursor-pointer">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code} className={isDarkMode ? 'text-black' : ''}>{c.flag} {c.code}</option>)}
                      </select>
                      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 bg-transparent text-right font-black text-2xl outline-none min-w-0" />
                    </div>
                  </div>
                  <div className="flex justify-center -my-3 relative z-10">
                    <button onClick={handleSwap} className={`p-3 rounded-full border-2 transition-colors shadow-sm active:scale-90 ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d] hover:border-[#58cc02] text-[#afafaf]' : 'bg-white border-[#e5e5e5] hover:border-[#58cc02] text-[#afafaf]'}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-[#afafaf] uppercase tracking-widest ml-1">Destino:</label>
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-[#58cc02] transition-all overflow-hidden ${isDarkMode ? 'bg-[#131f24]' : 'bg-[#f7f7f7]'}`}>
                      <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="bg-transparent font-black text-lg outline-none cursor-pointer">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code} className={isDarkMode ? 'text-black' : ''}>{c.flag} {c.code}</option>)}
                      </select>
                      <div className="flex-1 text-right font-black text-2xl text-[#58cc02] truncate">{loading ? '...' : convertedAmount}</div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border-2 p-4 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-[#f7f7f7] border-[#e5e5e5]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#58cc02] rounded-full animate-ping"></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider opacity-50">ExchangeRate-API</p>
                      <p className="text-[11px] font-bold">Actualizado {lastUpdate?.date}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-black text-[#58cc02]">{lastUpdate?.time}</p>
                </div>

                <div className={`rounded-3xl border-2 p-6 space-y-6 shadow-sm transition-colors ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`}>
                  <div className="flex flex-wrap justify-between gap-2">
                    {(['1D', '5D', '1M', '6M', '1A', '6A', 'TODO'] as TimeRange[]).map((range) => (
                      <button key={range} onClick={() => setTimeRange(range)} className={`px-3 py-1 rounded-lg font-black text-[10px] border-b-2 ${timeRange === range ? 'bg-[#1cb0f6] text-white border-[#1899d6]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:border-white/10'}`}>{range}</button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xs font-black text-[#afafaf] uppercase tracking-widest mb-4">Tendencia Interactiva</h3>
                    <div className="relative overflow-visible">{renderChart}</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'favoritos' && (
              <div className="space-y-6">
                <div className="text-center md:text-left mb-8"><h2 className="text-3xl font-black">Favoritos</h2><p className="text-[#afafaf] font-bold">Tus conversiones guardadas</p></div>
                
                <div className={`rounded-2xl border-2 p-4 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-[#f7f7f7] border-[#e5e5e5]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#58cc02] rounded-full animate-ping"></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider opacity-50">ExchangeRate-API</p>
                      <p className="text-[11px] font-bold">Actualizado {lastUpdate?.date}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-black text-[#58cc02]">{lastUpdate?.time}</p>
                </div>

                {favorites.length === 0 ? (
                  <div className="text-center py-12 opacity-50"><div className="text-6xl mb-4">⭐</div><p className="font-black">¡Aún no tienes favoritos!</p></div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {favorites.map(fav => (
                      <div key={fav.id} onClick={() => handleSelectFavorite(fav)} className={`relative flex flex-col p-4 rounded-3xl border-2 border-b-6 transition-all cursor-pointer active:translate-y-1 active:border-b-2 ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d] hover:border-[#1cb0f6]' : 'bg-white border-[#e5e5e5] hover:border-[#1cb0f6]'}`}>
                        <button onClick={(e) => removeFavorite(fav.id, e)} className="absolute top-3 right-3 text-[#afafaf] hover:text-[#ff4b4b] transition-colors p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                           </svg>
                        </button>
                        <div className="flex items-center justify-between mb-2 pr-10">
                          <span className="text-3xl">{fav.fromFlag}</span>
                          <span className="font-black text-xl truncate ml-2">{fav.amount} {fav.from}</span>
                        </div>
                        <div className="border-t pt-2 mt-2 flex justify-between">
                          <span className="text-3xl">{fav.toFlag}</span>
                          <span className="font-black text-xl text-[#58cc02]">{((fav.amount * (rates[fav.to] || 0)) / (rates[fav.from] || 1)).toFixed(2)} {fav.to}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ajustes' && (
              <div className="space-y-8">
                <div className="text-center md:text-left mb-8"><h2 className="text-3xl font-black">Ajustes</h2><p className="text-[#afafaf] font-bold">Personaliza tu experiencia</p></div>
                <div className={`rounded-3xl border-2 p-6 transition-colors flex items-center justify-between cursor-pointer ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`} onClick={() => setIsDarkMode(!isDarkMode)}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-[#1cb0f6]' : 'bg-gray-100'}`}><span>{isDarkMode ? '🌙' : '☀️'}</span></div>
                    <span className="font-black text-lg">Modo Oscuro</span>
                  </div>
                  <div className={`w-14 h-8 rounded-full p-1 relative ${isDarkMode ? 'bg-[#58cc02]' : 'bg-gray-200'}`}><div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isDarkMode ? 'translate-x-6' : ''}`}></div></div>
                </div>

                <div className={`rounded-3xl border-2 p-6 transition-colors ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`}>
                  <h3 className="text-xs font-black text-[#afafaf] uppercase tracking-widest mb-6">Acerca de los datos</h3>
                  
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#58cc02] text-white">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                        <h4 className="font-black text-lg">Tasas en tiempo real</h4>
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-[#afafaf]' : 'text-gray-500'}`}>Proporcionado por <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="text-[#1cb0f6] hover:underline">ExchangeRate-API</a></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-[#ff9600] text-white">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <h4 className="font-black text-lg">Historial de precios</h4>
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-[#afafaf]' : 'text-gray-500'}`}>Datos históricos vía <a href="https://www.frankfurter.app" target="_blank" rel="noreferrer" className="text-[#1cb0f6] hover:underline">Frankfurter API</a></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Desktop Sidebar Content - Tab Inicio */}
          {activeTab === 'inicio' && (
            <div className="flex flex-col gap-6 mt-6 md:mt-0">
              <QuickTable />
              <div className={`rounded-3xl border-2 p-6 h-fit ${isDarkMode ? 'bg-[#1b2e35] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`}>
                <h3 className="text-xs font-black text-[#afafaf] uppercase tracking-widest mb-4">Información</h3>
                <p className="text-sm font-bold opacity-70">Convierte divisas con las tasas más actualizadas del mercado. ¡Ahorra en tus viajes!</p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Nav - Visible only on mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 border-t-2 px-4 py-2 flex justify-around z-40 ${isDarkMode ? 'bg-[#131f24] border-[#3c444d]' : 'bg-white border-[#e5e5e5]'}`}>
        <NavButton tab="inicio" label="Inicio" color="#58cc02" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>} />
        <NavButton tab="favoritos" label="Favs" color="#ff9600" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>} />
        <NavButton tab="ajustes" label="Ajustes" color="#1cb0f6" icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
      </nav>
    </div>
  );
};

export default App;