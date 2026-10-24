/** A small, consistent icon set (1.75 stroke, 24 grid). Decorative unless given a title. */
type P = { size?: number; className?: string };
const base = (size = 16) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const IconPlus = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>;
export const IconArrowUp = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
export const IconStop = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" /></svg>;
export const IconPencil = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
export const IconCopy = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>;
export const IconChevron = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="m9 6 6 6-6 6" /></svg>;
export const IconMenu = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconClose = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconCheck = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconServer = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7.5 7.5h.01M7.5 16.5h.01" /></svg>;
export const IconChat = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /></svg>;
export const IconHome = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" /></svg>;
export const IconLogOut = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>;
export const IconRefresh = ({ size, className }: P) => <svg {...base(size)} className={className}><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4" /></svg>;
export const IconAlert = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></svg>;
export const IconCard = ({ size, className }: P) => <svg {...base(size)} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>;
export const IconSettings = ({ size, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
