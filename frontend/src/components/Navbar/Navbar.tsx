const Navbar: React.FC = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a1a]/90 backdrop-blur-md border-b border-violet-900/40">
    <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
      <span className="text-lg font-bold tracking-tight uppercase bg-gradient-to-r from-[#7b2fff] to-[#00d4ff] bg-clip-text text-transparent">
        Space Gods Bootcamp
      </span>
      <span className="text-xs text-violet-400 tracking-wider uppercase">In Development</span>
    </div>
  </nav>
);

export default Navbar;
