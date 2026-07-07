import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Loader2,
  Volume2,
  Tv
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { gsap } from 'gsap';

interface ProductDemoPlayerProps {
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAuthenticated: boolean;
  handleQuickLogin: (email: string, pass: string) => void;
  handleLogout: () => void;
  setViewMode?: (mode: 'pc' | 'mobile') => void;
}

export function ProductDemoPlayer({
  onClose,
  activeTab,
  setActiveTab,
  isAuthenticated,
  handleQuickLogin,
  handleLogout,
  setViewMode
}: ProductDemoPlayerProps) {
  // UI states
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showOutro, setShowOutro] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Đang chuẩn bị trailer giới thiệu...');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Marketing Overlay Text State
  const [marketingText, setMarketingText] = useState({
    title: '',
    subtitle: '',
    visible: false
  });

  // Ripple effect state
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  // Refs
  const cursorRef = useRef<HTMLDivElement>(null);
  const introOverlayRef = useRef<HTMLDivElement>(null);
  const outroOverlayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const rippleIdRef = useRef(0);
  const isPlayingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio system hook for commercial sync
  const triggerSound = (type: 'whoosh' | 'click' | 'pop' | 'success') => {
    if (!soundEnabled) return;
    
    // We log the sound cues in console so the developer can attach HTML5 Audio or Web Audio API easily
    console.log(`[Sound Event] Play sound type: ${type}`);
    
    // Synthesize simple web audio API bleeps/whooshes if user enables audio!
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'click') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'whoosh') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gain2.gain.setValueAtTime(0.05, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio context blocked or unsupported
    }
  };

  // Synchronize body overflow to hide layout scrollbars during zooms
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (setViewMode) setViewMode('pc');
    
    return () => {
      document.body.style.overflow = '';
      // Reset viewport styling on component unmount
      const viewport = document.getElementById('demo-camera-viewport');
      if (viewport) {
        gsap.killTweensOf(viewport);
        viewport.style.transform = '';
        viewport.style.filter = '';
      }
    };
  }, [setViewMode]);

  // Handle Authentication trigger to resume timeline
  useEffect(() => {
    if (isAuthenticated && timelineRef.current && timelineRef.current.isActive() === false) {
      // Resume timeline once logged in
      setStatusMessage("Xác thực thành công. Tiếp tục giới thiệu...");
      triggerSound('success');
      timelineRef.current.resume();
    }
  }, [isAuthenticated]);

  // ----------------- VIRTUAL 3D CAMERA MATH -----------------

  const getFocusParams = (selector: string, zoom = 1.25) => {
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) return { x: 0, y: 0, scale: zoom };
    
    const rect = el.getBoundingClientRect();
    const elemX = rect.left + rect.width / 2;
    const elemY = rect.top + rect.height / 2;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // dx, dy are the shifts needed to bring the element center to viewport center
    const dx = (centerX - elemX) * zoom;
    const dy = (centerY - elemY) * zoom;
    
    return { x: dx, y: dy, scale: zoom };
  };

  const getElementCoords = (selector: string, offset = { x: 0, y: 0 }) => {
    const el = document.querySelector(selector) as HTMLElement;
    if (!el) return { x: 0, y: 0 };
    
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 + window.scrollX + offset.x,
      y: rect.top + rect.height / 2 + window.scrollY + offset.y
    };
  };

  // Click ripple simulation
  const addRipple = (x: number, y: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 1000);
  };

  // ----------------- BUILD GSAP COMMERCIAL TIMELINE -----------------

  const initTimeline = () => {
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const viewport = '#demo-camera-viewport';
    const cursor = cursorRef.current;
    const intro = introOverlayRef.current;
    const outro = outroOverlayRef.current;

    // Reset components to initial clean state
    gsap.set(viewport, { scale: 1, x: 0, y: 0, filter: 'blur(0px)' });
    gsap.set(cursor, { x: -100, y: -100, opacity: 0 });
    gsap.set(intro, { display: 'flex', opacity: 1 });
    gsap.set(outro, { display: 'none', opacity: 0 });

    const tl = gsap.timeline({
      onUpdate: () => {
        // We sync the progress to UI if needed
      },
      onComplete: () => {
        setIsPlaying(false);
        setMarketingText(prev => ({ ...prev, visible: false }));
        gsap.to(cursor, { opacity: 0, duration: 0.5 });
        
        // Show outro screen
        gsap.set(outro, { display: 'flex' });
        gsap.to(outro, { opacity: 1, duration: 1.5, ease: 'power2.out' });
        setShowOutro(true);
      }
    });

    timelineRef.current = tl;

    // --- SCENE 1: CINEMATIC INTRO (0s - 4.5s) ---
    tl.addLabel('intro', 0);
    tl.to('#intro-logo-container', { scale: 1, opacity: 1, duration: 1.5, ease: 'power3.out' }, 'intro+=0.5');
    tl.to('#intro-slogan', { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, 'intro+=1.2');
    
    // Zoom out the website layout in the background during reveal
    tl.set(viewport, { scale: 0.7, filter: 'blur(5px)' }, 0);
    
    // Transition from Intro to Login
    tl.call(() => triggerSound('whoosh'), [], 'intro+=3.5');
    tl.to(intro, { opacity: 0, duration: 1, ease: 'power2.inOut' }, 'intro+=3.5');
    tl.to(viewport, { scale: 1.25, filter: 'blur(0px)', duration: 1.5, ease: 'power3.inOut' }, 'intro+=3.5');
    tl.call(() => gsap.set(intro, { display: 'none' }), [], 'intro+=4.5');

    // --- SCENE 2: LOG IN WORKFLOW (4.5s - 12s) ---
    tl.addLabel('login', 4.5);
    tl.call(() => setStatusMessage("Đang tiến hành đăng nhập..."), [], 'login');
    tl.to(cursor, { opacity: 1, duration: 0.5 }, 'login');

    // Move to Email input
    tl.to(cursor, {
      x: () => getElementCoords('input[type="email"]').x,
      y: () => getElementCoords('input[type="email"]').y,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 'login+=0.5');

    // Focus & Highlight Email Input
    tl.to(viewport, {
      x: () => getFocusParams('input[type="email"]', 1.35).x,
      y: () => getFocusParams('input[type="email"]', 1.35).y,
      scale: 1.35,
      duration: 1,
      ease: 'power2.out'
    }, 'login+=0.5');
    tl.call(() => triggerSound('click'), [], 'login+=1.7');

    // Type email
    const emailStr = 'viet@studio.com';
    const emailObj = { charCount: 0 };
    tl.to(emailObj, {
      charCount: emailStr.length,
      duration: 1,
      ease: 'none',
      onUpdate: () => {
        const input = document.querySelector('input[type="email"]') as HTMLInputElement;
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          const val = emailStr.substring(0, Math.ceil(emailObj.charCount));
          if (nativeSetter) nativeSetter.call(input, val);
          else input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 'login+=1.8');

    // Move to Password input
    tl.to(cursor, {
      x: () => getElementCoords('input[type="password"]').x,
      y: () => getElementCoords('input[type="password"]').y,
      duration: 0.8,
      ease: 'power2.inOut'
    }, 'login+=3.2');
    tl.to(viewport, {
      x: () => getFocusParams('input[type="password"]', 1.35).x,
      y: () => getFocusParams('input[type="password"]', 1.35).y,
      scale: 1.35,
      duration: 0.8,
      ease: 'power2.inOut'
    }, 'login+=3.2');
    tl.call(() => triggerSound('click'), [], 'login+=4');

    // Type password
    const passStr = 'admin123';
    const passObj = { charCount: 0 };
    tl.to(passObj, {
      charCount: passStr.length,
      duration: 0.8,
      ease: 'none',
      onUpdate: () => {
        const input = document.querySelector('input[type="password"]') as HTMLInputElement;
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          const val = passStr.substring(0, Math.ceil(passObj.charCount));
          if (nativeSetter) nativeSetter.call(input, val);
          else input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 'login+=4.1');

    // Move to Login Button
    tl.to(cursor, {
      x: () => getElementCoords('button[type="submit"]').x,
      y: () => getElementCoords('button[type="submit"]').y,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'login+=5.2');
    tl.to(viewport, {
      x: () => getFocusParams('button[type="submit"]', 1.35).x,
      y: () => getFocusParams('button[type="submit"]', 1.35).y,
      scale: 1.35,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'login+=5.2');
    
    // Click submit
    tl.call(() => {
      const coords = getElementCoords('button[type="submit"]');
      addRipple(coords.x, coords.y);
      triggerSound('click');
      
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) btn.click();
      
      // Pause timeline to wait for network authentication response
      tl.pause();
    }, [], 'login+=5.8');

    // --- SCENE 3: DASHBOARD WORKSPACE (12s - 20s) ---
    tl.addLabel('dashboard', 12);
    tl.call(() => {
      setStatusMessage("Khám phá Bảng chỉ số điều hành Dashboard...");
      // Show marketing overlays
      setMarketingText({
        title: "TỐI ƯU HÓA HOẠT ĐỘNG",
        subtitle: "Quản lý doanh thu và chỉ số điều hành thời gian thực",
        visible: true
      });
      triggerSound('whoosh');
    }, [], 'dashboard');

    // Transition zoom out of dashboard with blur
    tl.to(viewport, { scale: 0.9, x: 0, y: 0, filter: 'blur(3px)', duration: 1, ease: 'power3.inOut' }, 'dashboard');
    tl.call(() => setActiveTab('dashboard'), [], 'dashboard+=0.5');
    tl.to(viewport, { scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 'dashboard+=1.2');

    // Pan to stats cards
    tl.to(viewport, {
      x: () => getFocusParams('.grid.grid-cols-2.lg\\:grid-cols-4', 1.2).x,
      y: () => getFocusParams('.grid.grid-cols-2.lg\\:grid-cols-4', 1.2).y,
      scale: 1.2,
      duration: 1.5,
      ease: 'power2.inOut'
    }, 'dashboard+=2');
    tl.to(cursor, {
      x: () => getElementCoords('.grid.grid-cols-2.lg\\:grid-cols-4').x,
      y: () => getElementCoords('.grid.grid-cols-2.lg\\:grid-cols-4').y,
      duration: 1,
      ease: 'power2.inOut'
    }, 'dashboard+=2');

    // Scroll dashboard content
    const scrollObj = { y: 0 };
    tl.to(scrollObj, {
      y: 350,
      duration: 2.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = scrollObj.y;
      }
    }, 'dashboard+=3.8');
    tl.to(viewport, {
      x: 0,
      y: -100, // pan up slightly as we scroll down
      scale: 1.05,
      duration: 2.2,
      ease: 'power2.inOut'
    }, 'dashboard+=3.8');

    // Hide marketing text
    tl.to('#marketing-overlay-card', { opacity: 0, y: -20, duration: 0.5 }, 'dashboard+=6.5');
    tl.call(() => setMarketingText(prev => ({ ...prev, visible: false })), [], 'dashboard+=7');

    // --- SCENE 4: CRM LEADS WORKSPACE (20s - 30s) ---
    tl.addLabel('crm', 20);
    tl.call(() => {
      setStatusMessage("Trải nghiệm CRM Leads & Phễu khách hàng...");
      // Scroll main layout back to top
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
      
      setMarketingText({
        title: "CRM TỰ ĐỘNG HÓA",
        subtitle: "Giám sát quy trình chăm sóc từ Tiếp cận đến Chốt hợp đồng",
        visible: true
      });
      triggerSound('whoosh');
    }, [], 'crm');

    // Transition CRM Leads tab
    tl.to(viewport, { scale: 0.88, x: 0, y: 0, filter: 'blur(3.5px)', duration: 1, ease: 'power3.inOut' }, 'crm');
    tl.call(() => {
      const tabBtn = document.querySelector('button[data-demo-tab="leads"]') as HTMLButtonElement;
      if (tabBtn) tabBtn.click();
    }, [], 'crm+=0.5');
    tl.to(viewport, { scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 'crm+=1.2');

    // Move cursor to Kanban Board
    tl.to(cursor, {
      x: () => getElementCoords('.flex.gap-4.overflow-x-auto').x,
      y: () => getElementCoords('.flex.gap-4.overflow-x-auto').y,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 'crm+=1.5');
    tl.to(viewport, {
      x: () => getFocusParams('.flex.gap-4.overflow-x-auto', 1.05).x,
      y: () => getFocusParams('.flex.gap-4.overflow-x-auto', 1.05).y,
      scale: 1.05,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 'crm+=1.5');

    // Move cursor to "Add Lead" button
    tl.to(cursor, {
      x: () => getElementCoords('button[data-demo-btn="add-lead"]').x,
      y: () => getElementCoords('button[data-demo-btn="add-lead"]').y,
      duration: 1,
      ease: 'power2.inOut'
    }, 'crm+=3.5');
    tl.to(viewport, {
      x: () => getFocusParams('button[data-demo-btn="add-lead"]', 1.25).x,
      y: () => getFocusParams('button[data-demo-btn="add-lead"]', 1.25).y,
      scale: 1.25,
      duration: 1,
      ease: 'power2.inOut'
    }, 'crm+=3.5');

    // Click "Add Lead"
    tl.call(() => {
      const coords = getElementCoords('button[data-demo-btn="add-lead"]');
      addRipple(coords.x, coords.y);
      triggerSound('click');
      const btn = document.querySelector('button[data-demo-btn="add-lead"]') as HTMLButtonElement;
      if (btn) btn.click();
    }, [], 'crm+=4.5');

    // Fill new lead name
    tl.to(viewport, {
      x: 0,
      y: 0,
      scale: 1.15,
      duration: 0.8,
      ease: 'power2.out'
    }, 'crm+=5.5');
    tl.to(cursor, {
      x: () => getElementCoords('input[placeholder="Ví dụ: Nguyễn Thị Lan"]').x,
      y: () => getElementCoords('input[placeholder="Ví dụ: Nguyễn Thị Lan"]').y,
      duration: 0.8,
      ease: 'power2.inOut'
    }, 'crm+=5.5');

    // Type new lead name
    const leadName = 'Nguyễn Hoàng Nam';
    const nameObj = { charCount: 0 };
    tl.to(nameObj, {
      charCount: leadName.length,
      duration: 0.8,
      ease: 'none',
      onUpdate: () => {
        const input = document.querySelector('input[placeholder="Ví dụ: Nguyễn Thị Lan"]') as HTMLInputElement;
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          const val = leadName.substring(0, Math.ceil(nameObj.charCount));
          if (nativeSetter) nativeSetter.call(input, val);
          else input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 'crm+=6.4');

    // Type notes
    tl.to(cursor, {
      x: () => getElementCoords('textarea[placeholder*="Khách muốn chụp phong cách nhẹ nhàng"]').x,
      y: () => getElementCoords('textarea[placeholder*="Khách muốn chụp phong cách nhẹ nhàng"]').y,
      duration: 0.8,
      ease: 'power2.inOut'
    }, 'crm+=7.4');
    tl.to(viewport, {
      x: 0,
      y: 0,
      scale: 1.15,
      duration: 0.8,
      ease: 'power2.inOut'
    }, 'crm+=7.4');

    const leadNotes = 'Khách tìm hiểu gói chụp pre-wedding Đà Lạt.';
    const notesObj = { charCount: 0 };
    tl.to(notesObj, {
      charCount: leadNotes.length,
      duration: 1,
      ease: 'none',
      onUpdate: () => {
        const input = document.querySelector('textarea[placeholder*="Khách muốn chụp phong cách nhẹ nhàng"]') as HTMLTextAreaElement;
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          const val = leadNotes.substring(0, Math.ceil(notesObj.charCount));
          if (nativeSetter) nativeSetter.call(input, val);
          else input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 'crm+=8.3');

    // Move to Submit Lead button
    tl.to(cursor, {
      x: () => getElementCoords('button[type="submit"]').x,
      y: () => getElementCoords('button[type="submit"]').y,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'crm+=9.5');
    tl.to(viewport, {
      x: 0,
      y: 0,
      scale: 1.15,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'crm+=9.5');

    // Click submit
    tl.call(() => {
      const coords = getElementCoords('button[type="submit"]');
      addRipple(coords.x, coords.y);
      triggerSound('click');
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) btn.click();
    }, [], 'crm+=10.2');

    // Hide marketing text
    tl.to('#marketing-overlay-card', { opacity: 0, y: -20, duration: 0.5 }, 'crm+=10.2');
    tl.call(() => setMarketingText(prev => ({ ...prev, visible: false })), [], 'crm+=10.7');

    // --- SCENE 5: CONTRACTS & ORDERS WORKSPACE (31s - 38s) ---
    tl.addLabel('orders', 31);
    tl.call(() => {
      setStatusMessage("Giám sát Hợp đồng & Doanh thu...");
      setMarketingText({
        title: "HỢP ĐỒNG KHÉP KÍN",
        subtitle: "Lưu giữ chi tiết các gói cưới dịch vụ và tiến trình đặt cọc",
        visible: true
      });
      triggerSound('whoosh');
    }, [], 'orders');

    // Transition Orders tab
    tl.to(viewport, { scale: 0.9, x: 0, y: 0, filter: 'blur(3px)', duration: 1, ease: 'power3.inOut' }, 'orders');
    tl.call(() => {
      const tabBtn = document.querySelector('button[data-demo-tab="orders"]') as HTMLButtonElement;
      if (tabBtn) tabBtn.click();
    }, [], 'orders+=0.5');
    tl.to(viewport, { scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 'orders+=1.2');

    // Focus on Orders list
    tl.to(viewport, {
      x: () => getFocusParams('table', 1.15).x,
      y: () => getFocusParams('table', 1.15).y,
      scale: 1.15,
      duration: 1.5,
      ease: 'power2.inOut'
    }, 'orders+=1.5');
    tl.to(cursor, {
      x: () => getElementCoords('table').x,
      y: () => getElementCoords('table').y,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 'orders+=1.5');

    // Hide marketing text
    tl.to('#marketing-overlay-card', { opacity: 0, y: -20, duration: 0.5 }, 'orders+=5.5');
    tl.call(() => setMarketingText(prev => ({ ...prev, visible: false })), [], 'orders+=6');

    // --- SCENE 6: STAFF COORDINATION / INTERNAL CHAT (38s - 48s) ---
    tl.addLabel('chat', 38);
    tl.call(() => {
      setStatusMessage("Phối hợp thời gian thực thông qua Chat nội bộ...");
      setMarketingText({
        title: "KẾT NỐI ĐỒNG BỘ",
        subtitle: "Nhân viên tương tác và giải quyết lịch chụp tức thì",
        visible: true
      });
      triggerSound('whoosh');
    }, [], 'chat');

    // Transition Chat tab
    tl.to(viewport, { scale: 0.9, x: 0, y: 0, filter: 'blur(3px)', duration: 1, ease: 'power3.inOut' }, 'chat');
    tl.call(() => {
      const tabBtn = document.querySelector('button[data-demo-tab="chat"]') as HTMLButtonElement;
      if (tabBtn) tabBtn.click();
    }, [], 'chat+=0.5');
    tl.to(viewport, { scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 'chat+=1.2');

    // Focus Chat container
    tl.to(viewport, {
      x: () => getFocusParams('#chat-messages-container', 1.15).x,
      y: () => getFocusParams('#chat-messages-container', 1.15).y,
      scale: 1.15,
      duration: 1.2,
      ease: 'power2.inOut'
    }, 'chat+=1.5');

    // Focus Chat input
    tl.to(cursor, {
      x: () => getElementCoords('#chat-input-field').x,
      y: () => getElementCoords('#chat-input-field').y,
      duration: 1,
      ease: 'power2.inOut'
    }, 'chat+=2.5');
    tl.to(viewport, {
      x: () => getFocusParams('#chat-input-field', 1.25).x,
      y: () => getFocusParams('#chat-input-field', 1.25).y,
      scale: 1.25,
      duration: 1,
      ease: 'power2.inOut'
    }, 'chat+=2.5');
    tl.call(() => triggerSound('click'), [], 'chat+=3.5');

    // Type chat content
    const chatMsg = 'Chúc toàn ekip một tuần mới chốt thật nhiều hợp đồng lớn nhé! 🚀';
    const chatObj = { charCount: 0 };
    tl.to(chatObj, {
      charCount: chatMsg.length,
      duration: 1.2,
      ease: 'none',
      onUpdate: () => {
        const input = document.querySelector('#chat-input-field') as HTMLInputElement;
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
          const val = chatMsg.substring(0, Math.ceil(chatObj.charCount));
          if (nativeSetter) nativeSetter.call(input, val);
          else input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 'chat+=3.6');

    // Move to send btn
    tl.to(cursor, {
      x: () => getElementCoords('#chat-send-btn').x,
      y: () => getElementCoords('#chat-send-btn').y,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'chat+=5');
    tl.to(viewport, {
      x: () => getFocusParams('#chat-send-btn', 1.25).x,
      y: () => getFocusParams('#chat-send-btn', 1.25).y,
      scale: 1.25,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 'chat+=5');

    // Click Send
    tl.call(() => {
      const coords = getElementCoords('#chat-send-btn');
      addRipple(coords.x, coords.y);
      triggerSound('pop');
      const btn = document.querySelector('#chat-send-btn') as HTMLButtonElement;
      if (btn) btn.click();
    }, [], 'chat+=5.7');

    // Wait and hide overlays
    tl.to('#marketing-overlay-card', { opacity: 0, y: -20, duration: 0.5 }, 'chat+=8.5');
    tl.call(() => setMarketingText(prev => ({ ...prev, visible: false })), [], 'chat+=9');

    // --- SCENE 7: CINEMATIC OUTRO & CALL TO ACTION (48s - 54s) ---
    tl.addLabel('outro', 48);
    tl.call(() => {
      setStatusMessage("Hoàn tất buổi trình diễn.");
      triggerSound('whoosh');
    }, [], 'outro');

    // Website fades away and zooms out into blur
    tl.to(viewport, {
      scale: 0.5,
      x: 0,
      y: 0,
      opacity: 0,
      filter: 'blur(15px)',
      duration: 2.2,
      ease: 'power3.inOut'
    }, 'outro');

    // Automatically stop recording when outro completes
    tl.call(() => {
      stopScreenRecording();
    }, [], 'outro+=2.2');
  };

  // Screen recording trigger functions using standard browser Screen Capture stream
  const startScreenRecording = async () => {
    try {
      // Capture viewport area
      if (!(navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia)) {
        alert("Trình duyệt không hỗ trợ ghi hình màn hình. Vui lòng sử dụng Chrome, Edge hoặc Firefox.");
        return false;
      }

      const captureStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        },
        audio: true
      });

      streamRef.current = captureStream;
      recordedChunksRef.current = [];

      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
        }
      }

      const recorder = new MediaRecorder(captureStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `TheWill_Studio_Commercial_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        setIsRecording(false);
        setStatusMessage("Đã xuất video thành công và tải xuống!");
        triggerSound('success');
      };

      recorder.start(1000); // chunk every 1 second
      setIsRecording(true);
      
      // Stop stream tracks if user cancels sharing
      captureStream.getVideoTracks()[0].onended = () => {
        stopScreenRecording();
      };

      return true;
    } catch (e) {
      console.error("Recording error:", e);
      setIsRecording(false);
      return false;
    }
  };

  const stopScreenRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Launch demo with video recording enabled
  const handleStartDemoWithRecord = async () => {
    const success = await startScreenRecording();
    if (success) {
      handleStartDemo();
    }
  };

  // Run on first play click
  const handleStartDemo = () => {
    setShowWelcome(false);
    setIsPlaying(true);
    initTimeline();
    setTimeout(() => {
      if (timelineRef.current) {
        timelineRef.current.play();
        isPlayingRef.current = true;
      }
    }, 100);
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (showWelcome) {
      handleStartDemo();
      return;
    }

    if (isPlaying) {
      if (timelineRef.current) timelineRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      if (timelineRef.current) {
        // If outro is visible, restart
        if (showOutro) {
          handleRestartDemo();
        } else {
          timelineRef.current.resume();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      } else {
        handleStartDemo();
      }
    }
  };

  // Monitor recording track duration
  useEffect(() => {
    let interval: any;
    if (isRecording && timelineRef.current) {
      interval = setInterval(() => {
        const time = timelineRef.current?.time() || 0;
        const duration = timelineRef.current?.duration() || 54;
        setRecordProgress(Math.min(100, Math.round((time / duration) * 100)));
      }, 500);
    } else {
      setRecordProgress(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Jump to specific label (welcome / login / dashboard / crm / orders / chat / outro)
  const handleJumpToStep = (label: string, stepIdx: number) => {
    if (showWelcome) {
      setShowWelcome(false);
    }
    
    if (showOutro) {
      setShowOutro(false);
      const outro = outroOverlayRef.current;
      if (outro) gsap.set(outro, { display: 'none', opacity: 0 });
    }

    setMarketingText(prev => ({ ...prev, visible: false }));

    if (!timelineRef.current) {
      initTimeline();
    }

    const tl = timelineRef.current;
    if (tl) {
      // If jumping to dashboard or later and not authenticated, we quick log in first!
      if (label !== 'intro' && label !== 'login' && !isAuthenticated) {
        setStatusMessage("Đang đăng nhập nhanh...");
        handleQuickLogin('viet@studio.com', 'admin123');
        // Wait briefly for auth then seek
        setTimeout(() => {
          tl.seek(label);
          tl.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }, 1000);
        return;
      }

      // If jumping back to login from authenticated view, we log out
      if (label === 'login' && isAuthenticated) {
        handleLogout();
        setTimeout(() => {
          tl.seek(label);
          tl.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }, 1000);
        return;
      }

      tl.seek(label);
      tl.play();
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
  };

  // Restart Demo
  const handleRestartDemo = () => {
    setShowOutro(false);
    setShowWelcome(false);
    
    const outro = outroOverlayRef.current;
    if (outro) gsap.set(outro, { display: 'none', opacity: 0 });

    if (isAuthenticated) {
      handleLogout();
      setTimeout(() => {
        initTimeline();
        if (timelineRef.current) {
          timelineRef.current.play();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      }, 1000);
    } else {
      initTimeline();
      if (timelineRef.current) {
        timelineRef.current.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
      }
    }
  };

  // Exit demo and trigger database cleanup
  const handleExitDemo = async () => {
    if (timelineRef.current) {
      timelineRef.current.kill();
    }
    
    // Reset camera viewport style
    const viewport = document.getElementById('demo-camera-viewport');
    if (viewport) {
      viewport.style.transform = '';
      viewport.style.filter = '';
      viewport.style.opacity = '';
    }

    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsCleaningUp(true);
    setStatusMessage("Đang dọn dẹp dữ liệu dùng thử...");
    
    try {
      await apiRequest('/api/demo/cleanup', 'POST');
    } catch (e) {
      console.error("Failed to clean up demo data:", e);
    } finally {
      setIsCleaningUp(false);
      onClose();
    }
  };

  // Sync speed scaling in GSAP
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.timeScale(speed);
    }
  }, [speed]);

  const stepsList = [
    { label: 'intro', name: 'Giới thiệu' },
    { label: 'login', name: 'Đăng nhập' },
    { label: 'dashboard', name: 'Dashboard' },
    { label: 'crm', name: 'CRM Leads' },
    { label: 'orders', name: 'Hợp đồng' },
    { label: 'chat', name: 'Phối hợp Chat' }
  ];

  const getActiveStepIdx = () => {
    if (!timelineRef.current) return 0;
    const time = timelineRef.current.time();
    
    // Check timing thresholds corresponding to GSAP label offsets
    if (time >= 48) return 6; // Outro
    if (time >= 38) return 5; // Chat
    if (time >= 31) return 4; // Orders
    if (time >= 20) return 3; // CRM Leads
    if (time >= 12) return 2; // Dashboard
    if (time >= 4.5) return 1; // Login
    return 0; // Intro
  };

  const activeStepIdx = getActiveStepIdx();

  return (
    <>
      {/* CSS CUSTOM FOR PREMIUM commercial STYLING */}
      <style dangerouslySetInnerHTML={{ __html: `
        .gold-glow-text {
          text-shadow: 0 0 15px rgba(202, 167, 76, 0.4);
        }
        .glow-btn:hover {
          box-shadow: 0 0 25px rgba(176, 138, 50, 0.5);
        }
        @keyframes sweep {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        .shining-sweep::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent);
          transform: skewX(-25deg);
          animation: sweep 4s infinite;
        }
        .animate-scale-up {
          animation: scaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes scaleUp {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />

      {/* 1. CINEMATIC OVERLAY CARD (floating slogans) */}
      {marketingText.visible && (
        <div 
          id="marketing-overlay-card" 
          className="fixed top-8 left-8 z-[9999] pointer-events-none select-none animate-scale-up"
        >
          <div className="bg-slate-950/80 backdrop-blur-md border border-gold-500/25 px-6 py-4 rounded-2xl shadow-2xl max-w-sm">
            <span className="text-[10px] text-gold-400 font-bold uppercase tracking-[0.25em] block mb-1">
              THE WILL SAAS COMMERCIAL
            </span>
            <h3 className="text-base font-semibold font-display italic text-white gold-glow-text">
              {marketingText.title}
            </h3>
            <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed font-sans font-medium">
              {marketingText.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* 2. AUDIO TOGGLE BUTTON */}
      <div className="fixed top-6 right-6 z-[9999]">
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            triggerSound('pop');
          }}
          className={`p-3 rounded-full border transition-all cursor-pointer ${
            soundEnabled 
              ? 'bg-gold-500/20 text-gold-400 border-gold-400/40 shadow-[0_0_15px_rgba(202,167,76,0.3)]' 
              : 'bg-slate-950/60 text-slate-400 border-slate-800'
          }`}
          title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh thương hiệu"}
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* 3. SIMULATED MOUSE CURSOR */}
      <div 
        ref={cursorRef}
        className="absolute pointer-events-none z-[9999] opacity-0"
        style={{
          width: 24,
          height: 24,
          transform: 'translate(-50%, -50%)',
          transition: 'opacity 0.5s ease'
        }}
      >
        {/* Glowing Cursor Circle */}
        <div className="w-6 h-6 rounded-full border-2 border-gold-400 bg-gold-400/25 shadow-[0_0_15px_rgba(202,167,76,0.85)] relative animate-pulse flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
        </div>
      </div>

      {/* Click ripples */}
      {ripples.map(r => (
        <div
          key={r.id}
          className="absolute pointer-events-none rounded-full border-2 border-gold-500/80 bg-gold-400/10 z-[9998] animate-ping"
          style={{
            left: r.x - 30,
            top: r.y - 30,
            width: 60,
            height: 60,
            animationDuration: '0.8s'
          }}
        />
      ))}

      {/* 4. INTRO OVERLAY (Cinematic screen at 0s) */}
      <div 
        ref={introOverlayRef}
        className="fixed inset-0 bg-slate-950 z-[99999] flex flex-col items-center justify-center p-8 text-white select-none"
      >
        <div 
          id="intro-logo-container" 
          className="flex flex-col items-center opacity-0 scale-[0.8] transition-all"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-slate-950 font-bold flex items-center justify-center shadow-[0_0_40px_rgba(202,167,76,0.5)] mb-6 relative overflow-hidden shining-sweep">
            <Sparkles className="w-10 h-10 text-gold-100" />
          </div>
          <h1 className="text-4xl font-semibold tracking-[0.18em] font-display text-gold-200 italic mb-2 gold-glow-text">
            THE WILL STUDIO
          </h1>
          <p 
            id="intro-slogan" 
            className="text-[10px] text-slate-400 uppercase tracking-[0.35em] font-bold opacity-0 translate-y-3 transition-all duration-700"
          >
            Luxury Wedding Studio SaaS
          </p>
        </div>
      </div>

      {/* 5. OUTRO OVERLAY (Completed video CTA screen) */}
      <div 
        ref={outroOverlayRef}
        className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-8 text-white select-none"
        style={{ display: 'none' }}
      >
        <div className="w-16 h-16 rounded-full bg-gold-500/20 text-gold-400 border border-gold-400/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(202,167,76,0.2)] animate-pulse">
          <Tv className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-semibold tracking-[0.12em] font-display text-gold-200 italic mb-2 gold-glow-text">
          Kiến Tạo Kiệt Tác Vận Hành
        </h2>
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold mb-8">
          The Will Studio Management App
        </p>

        <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-md text-center mb-10 font-sans font-medium">
          Dịch vụ tư vấn CRM, hợp đồng tự động, điều phối lịch chụp cưới thông minh, báo cáo doanh thu tức thì. Nâng cấp hiệu suất studio của bạn ngay hôm nay.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            onClick={handleRestartDemo}
            className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Xem lại Trailer</span>
          </button>
          <button
            onClick={handleExitDemo}
            className="flex-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs shadow-lg transition-all duration-300 scale-100 hover:scale-[1.02] cursor-pointer glow-btn"
          >
            Trải nghiệm thực tế
          </button>
        </div>
      </div>

      {/* 6. FLOATING CONTROL BAR */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[99999] w-[92%] max-w-3xl select-none">
        {isRecording && (
          <div className="bg-rose-950/90 border border-rose-500/40 text-rose-200 px-4 py-2 rounded-t-xl text-[10px] font-bold flex justify-between items-center animate-fade-in relative z-[-1] translate-y-2 border-b-0 shadow-lg">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>ĐANG GHI HÌNH CHẤT LƯỢNG CAO ({recordProgress}%)</span>
            </span>
            <button
              onClick={stopScreenRecording}
              className="bg-rose-800 hover:bg-rose-700 text-white px-2 py-0.5 rounded cursor-pointer"
            >
              Dừng & Tải Video
            </button>
          </div>
        )}
        <div className="bg-slate-950/85 hover:bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3 md:p-4 shadow-2xl relative overflow-hidden transition-all duration-300">
          
          {/* Gold Glowing accent top border */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500 to-transparent shadow-[0_0_10px_rgba(202,167,76,1)]" />

          {/* Mini progress line */}
          <div className="w-full h-1 bg-slate-800 rounded-full mb-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-500 rounded-full"
              style={{ width: `${(activeStepIdx / stepsList.length) * 100}%` }}
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
            
            {/* Status & Current Step */}
            <div className="flex items-center gap-2.5 min-w-0">
              {isPlaying && !isCleaningUp ? (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500"></span>
                </span>
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                  SaaS Commercial Trailer (Phân cảnh {activeStepIdx + 1}/{stepsList.length + 1})
                </p>
                <h4 className="text-xs font-bold text-slate-100 truncate mt-0.5 flex items-center gap-1">
                  {isCleaningUp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gold-400" />
                      <span>{statusMessage}</span>
                    </>
                  ) : (
                    <span>{statusMessage}</span>
                  )}
                </h4>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 shrink-0">
              
              {/* Prev Button */}
              <button
                onClick={() => {
                  const prevIdx = Math.max(0, activeStepIdx - 1);
                  const step = stepsList[prevIdx];
                  if (step) handleJumpToStep(step.label, prevIdx);
                }}
                disabled={activeStepIdx === 0 || isCleaningUp}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Cảnh trước"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>

              {/* Play Pause */}
              <button
                onClick={handleTogglePlay}
                disabled={isCleaningUp}
                className={`p-2.5 rounded-xl text-slate-950 font-bold transition-all shadow-md cursor-pointer ${
                  isPlaying 
                    ? 'bg-slate-200 hover:bg-white' 
                    : 'bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400'
                }`}
                title={isPlaying ? "Tạm dừng" : "Tiếp tục Trình diễn"}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 fill-current" />}
              </button>

              {/* Next Button */}
              <button
                onClick={() => {
                  const nextIdx = Math.min(stepsList.length - 1, activeStepIdx + 1);
                  const step = stepsList[nextIdx];
                  if (step) handleJumpToStep(step.label, nextIdx);
                }}
                disabled={activeStepIdx >= stepsList.length - 1 || isCleaningUp}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Cảnh tiếp theo"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>

              {/* Speed Controller */}
              <button
                onClick={() => setSpeed(s => s === 1 ? 1.5 : s === 1.5 ? 2 : 1)}
                disabled={isCleaningUp}
                className="bg-slate-900 border border-slate-800 text-gold-400 font-mono text-[10px] font-bold px-2 py-1.5 rounded-lg hover:text-white hover:border-slate-700 transition-all cursor-pointer min-w-[40px] text-center"
                title="Tốc độ phát"
              >
                {speed}x
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-slate-800 mx-1" />

              {/* Exit Button */}
              <button
                onClick={handleExitDemo}
                disabled={isCleaningUp}
                className="flex items-center gap-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/30 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                title="Thoát Demo & Dọn dẹp dữ liệu"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thoát</span>
              </button>

            </div>
          </div>

          {/* Quick jump step-dots at the bottom */}
          <div className="flex justify-center gap-1.5 mt-2.5 pt-2 border-t border-slate-900">
            {stepsList.map((step, idx) => (
              <button
                key={idx}
                onClick={() => handleJumpToStep(step.label, idx)}
                disabled={isCleaningUp}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activeStepIdx === idx 
                    ? 'w-6 bg-gold-400' 
                    : idx < activeStepIdx 
                    ? 'w-2 bg-gold-600/50' 
                    : 'w-2 bg-slate-800'
                }`}
                title={step.name}
              />
            ))}
          </div>

        </div>
      </div>

      {/* 7. WELCOME DIALOG (Glassmorphic Luxury Modal) */}
      {showWelcome && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-slate-900/90 border border-gold-500/30 rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(176,138,50,0.25)] overflow-hidden p-6 md:p-8 relative text-center text-white flex flex-col items-center">
            
            {/* Background design elements */}
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Studio Logo Badge */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-slate-950 font-bold flex items-center justify-center shadow-[0_0_20px_rgba(202,167,76,0.6)] mb-6 animate-pulse select-none relative overflow-hidden shining-sweep">
              <Sparkles className="w-8 h-8 text-gold-100" />
            </div>

            <h2 className="text-2xl font-semibold tracking-widest font-display text-gold-200 italic mb-2 gold-glow-text">
              The Will SaaS Commercial
            </h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-4">
              Mô phỏng Điện ảnh / Trailer Giới thiệu Sản phẩm
            </p>

            <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-6 font-sans">
              Chào mừng bạn đến với chế độ trình diễn Trailer Thương hiệu. Trình diễn sẽ tự động vận hành camera 3D ảo, dịch chuyển nhòe (Motion Blur), di chuột mượt và giới thiệu tính năng thông qua các lớp khẩu hiệu điện ảnh hiện đại.
            </p>

            {/* Demo features cards */}
            <div className="grid grid-cols-2 gap-3 w-full mb-8 text-left text-white">
              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
                <h5 className="text-[11px] font-bold text-gold-400 flex items-center gap-1">🎥 Camera 3D ảo</h5>
                <p className="text-[9px] text-slate-500 mt-0.5">Tự động Zoom, Pan và Blur mô phỏng máy quay điện ảnh chuyên nghiệp.</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl">
                <h5 className="text-[11px] font-bold text-gold-400 flex items-center gap-1">📹 Ghi hình & Tải Video</h5>
                <p className="text-[9px] text-slate-500 mt-0.5">Tự động quay hình lại tiến trình và xuất ra tệp video WebM chất lượng cao.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Khám phá tự do
                </button>
                <button
                  onClick={handleStartDemo}
                  className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-gold-400" />
                  <span>Xem bình thường</span>
                </button>
              </div>
              <button
                onClick={handleStartDemoWithRecord}
                className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-center gap-2 glow-btn"
              >
                <span>🔴 Bắt đầu Ghi hình & Tải Video</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
