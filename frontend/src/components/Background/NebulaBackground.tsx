'use client';

const NebulaBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(80,20,100,0.4) 0%, transparent 70%), #0a0618' }}>
    {/* Orb 1 - purple, top left */}
    <div className="absolute" style={{ top: '10%', left: '15%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'nebula-drift 16s ease-in-out infinite alternate' }} />
    {/* Orb 2 - pink, center right - BRIGHTER */}
    <div className="absolute" style={{ top: '30%', right: '10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(219,39,119,0.40) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'nebula-drift 20s ease-in-out infinite alternate', animationDelay: '-5s' }} />
    {/* Orb 3 - rose/pink blend, bottom left - BRIGHTER */}
    <div className="absolute" style={{ top: '60%', left: '5%', width: '550px', height: '550px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,121,249,0.35) 0%, rgba(236,72,153,0.25) 50%, transparent 70%)', filter: 'blur(80px)', animation: 'nebula-drift 18s ease-in-out infinite alternate', animationDelay: '-8s' }} />
    {/* Orb 4 - peach/warm, top right */}
    <div className="absolute" style={{ top: '5%', right: '25%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'nebula-drift 22s ease-in-out infinite alternate', animationDelay: '-3s' }} />
    {/* Orb 5 - violet, bottom right */}
    <div className="absolute" style={{ bottom: '10%', right: '15%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.30) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'nebula-drift 24s ease-in-out infinite alternate', animationDelay: '-12s' }} />
    {/* Noise grain overlay */}
    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '256px 256px' }} />
  </div>
);

export default NebulaBackground;
