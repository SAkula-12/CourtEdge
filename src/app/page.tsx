export default function Home() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Hello, Player. What would you like to work on today?</h1>
        <p className="text-slate-400">Your personalized tennis development system.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
          <h3 className="font-semibold text-lg mb-2 text-blue-400">Improve my serve</h3>
          <p className="text-sm text-slate-400 mb-4">Focus on your kick serve consistency based on recent matches.</p>
          <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full">Start Lesson</button>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
          <h3 className="font-semibold text-lg mb-2 text-indigo-400">Take today's challenge</h3>
          <p className="text-sm text-slate-400 mb-4">Analyze a professional point construction and decide the next shot.</p>
          <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full">Play Challenge</button>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
          <h3 className="font-semibold text-lg mb-2 text-emerald-400">Review recent match</h3>
          <p className="text-sm text-slate-400 mb-4">Your Gametime data from yesterday's match is ready for review.</p>
          <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full">View Recap</button>
        </div>
      </div>
    </div>
  );
}
