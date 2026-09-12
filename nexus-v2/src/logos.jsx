import React from 'react';

export function GPTLogo({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="OpenAI GPT">
      <path d="M84.38 49.35c.02 3.49-.58 6.97-1.8 10.27a34.8 34.8 0 0 1-8.26 13.56 34.84 34.84 0 0 1-13.55 8.26c-3.3 1.2-6.78 1.82-10.27 1.8-3.5-.02-6.98-.62-10.28-1.8-3.3-1.19-6.4-2.98-9.12-5.28l6.28-6.29a25.95 25.95 0 0 0 24.19-44.34l12.51-12.5c.37.36.73.74 1.08 1.13l-9.39 9.4a5 5 0 0 0-1.37 1.69 4.94 4.94 0 0 0-.67 2.25 5 5 0 0 0 1.37 3.55l5.36 5.36a5.02 5.02 0 0 0 3.54 1.37 5 5 0 0 0 2.25-.67 4.94 4.94 0 0 0 1.69-1.37l9.39-9.4c.23.28.44.57.65.87.52.78.97 1.59 1.34 2.42a34.97 34.97 0 0 1 0 22.63Z" fill="url(#gpt-a)"/>
      <path d="M15.63 50.65c-.02-3.49.58-6.97 1.8-10.27a34.8 34.8 0 0 1 8.26-13.56 34.84 34.84 0 0 1 13.55-8.26c3.3-1.2 6.78-1.82 10.27-1.8 3.5.02 6.98.62 10.28 1.8 3.3 1.19 6.4 2.98 9.12 5.28l-6.28 6.29a25.95 25.95 0 0 0-24.19 44.34L25.72 89.87a35.7 35.7 0 0 1-1.08-1.13l9.39-9.4a5 5 0 0 0 1.37-1.69 4.94 4.94 0 0 0 .67-2.25 5 5 0 0 0-1.37-3.55l-5.36-5.36a5.02 5.02 0 0 0-3.54-1.37 5 5 0 0 0-2.25.67 4.94 4.94 0 0 0-1.69 1.37l-9.39 9.4a35.08 35.08 0 0 1-1.99-3.29 34.97 34.97 0 0 1 0-22.63Z" fill="url(#gpt-b)"/>
      <defs>
        <linearGradient id="gpt-a" x1="12.56" y1="16.28" x2="102.87" y2="87.27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10A37F"/>
          <stop offset="1" stopColor="#1FA267"/>
        </linearGradient>
        <linearGradient id="gpt-b" x1="91.5" y1="18.24" x2="2.26" y2="94.39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10A37F"/>
          <stop offset="1" stopColor="#1FA267"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ClaudeLogo({ size = 18, className = '' }) {
  const px = size / 14;
  const shape = [
    [1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],
    [1,4],[3,4],[6,4],[8,4],
    [0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],
    [1,7],[2,7],[5,7],[6,7],
    [1,8],[2,8],[3,8],[5,8],[6,8],[7,8],
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${10 * px} ${10 * px}`} className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Claude">
      {shape.map(([x,y],i) => (
        <rect key={i} x={x*px} y={y*px} width={px} height={px} fill="#D97757"/>
      ))}
    </svg>
  );
}

export function V0Logo({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 60" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="v0">
      <path d="M5 47 L25 13 L30 13 L22 47 Z" fill="#000"/>
      <rect x="38" y="13" width="32" height="34" rx="8" fill="none" stroke="#000" strokeWidth="5.5"/>
      <path d="M45 30 L55 20 L70 20 L60 30 L70 40 L55 40 Z" fill="#fff" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter"/>
    </svg>
  );
}

export function NotebookLMLogo({ size = 18, className = '' }) {
  const w = size * 3;
  return (
    <svg width={w} height={size} viewBox="0 0 240 70" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="NotebookLM">
      <path d="M10 30c0-8.5 7-16 17-16s17 7.5 17 16-7 16-17 16S10 38.5 10 30Z" stroke="#fff" strokeWidth="3.2" fill="none"/>
      <path d="M10 41c0-8.5 7-16 17-16s17 7.5 17 16" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
      <path d="M10 52c0-8.5 7-16 17-16s17 7.5 17 16" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
      <g fill="#fff" fontFamily="'Segoe UI', Manrope, system-ui, sans-serif" fontWeight="700" letterSpacing="0.5">
        <text x="55" y="48" fontSize="42">NotebookLM</text>
      </g>
    </svg>
  );
}

export function ProviderBadge({ provider, size = 18 }) {
  const map = { gpt: GPTLogo, claude: ClaudeLogo, v0: V0Logo, notebooklm: NotebookLMLogo };
  const Cmp = map[provider];
  if (!Cmp) return <span>✦</span>;
  return <Cmp size={size}/>;
}
