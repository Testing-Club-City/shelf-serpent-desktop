import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Shield, Zap } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  onShowCopyright: () => void;
}

export function SplashScreen({ onComplete, onShowCopyright }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'zoom' | 'branding' | 'complete'>('logo');
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    if (!logoLoaded) return;

    // Phase 1: Show logo for 2.5 seconds
    const timer1 = setTimeout(() => {
      setPhase('zoom');
    }, 2500);

    // Phase 2: Zoom animation for 1.5 seconds
    const timer2 = setTimeout(() => {
      setPhase('branding');
    }, 4000);

    // Phase 3: Show branding for 4 seconds
    const timer3 = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [logoLoaded, onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center z-50 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221.5%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse"></div>
      </div>

      {/* Phase 1 & 2: Logo Display and Zoom */}
      {(phase === 'logo' || phase === 'zoom') && (
        <div className={`transition-all duration-1000 ease-in-out ${
          phase === 'zoom' ? 'scale-[3] opacity-0' : 'scale-100 opacity-100'
        }`}>
          <div className="relative flex items-center justify-center">
            {/* Main logo */}
            <div className="relative">
              <img
                src="/tamnet-new.png"
                alt="Tamnet Logo"
                className="w-52 h-52 drop-shadow-2xl animate-pulse"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoLoaded(true)}
              />
              {/* Glow effect */}
              <div className="absolute inset-0 w-52 h-52 bg-gradient-to-r from-blue-500/30 to-orange-500/30 rounded-full blur-2xl animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Branding Display */}
      {phase === 'branding' && (
        <div className="text-center animate-fade-in-up max-w-3xl mx-auto px-6">
          {/* Main Title */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4 tracking-wide">
              <span className="bg-gradient-to-r from-blue-200 via-white to-orange-200 bg-clip-text text-transparent">
                Kisii School
              </span>
            </h1>
            <h2 className="text-2xl font-semibold text-blue-200 mb-4 tracking-wide">
              Library Management System
            </h2>
            
            {/* Decorative line */}
            <div className="w-32 h-1 bg-gradient-to-r from-blue-400 via-orange-400 to-blue-400 mx-auto rounded-full mb-8"></div>
          </div>

          {/* Powered by section */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <span className="text-2xl font-medium text-blue-100 mr-4">Powered by</span>
            </div>
            
            <div className="flex items-center justify-center space-x-4 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 backdrop-blur-sm px-8 py-6 rounded-2xl border border-orange-400/30 shadow-2xl">
              <img
                src="/tamnet-new.png"
                alt="Tamnet"
                className="w-12 h-12 drop-shadow-lg"
              />
              <div className="text-left">
                <div className="text-3xl font-bold text-white tracking-wider">TAMNET</div>
                <div className="text-sm text-orange-300 font-medium">Systems & Solutions</div>
              </div>
            </div>
            
            <div className="mt-4 text-blue-300/80 italic text-lg">
              "Your strong partner in ICT"
            </div>
          </div>

          {/* Feature highlights */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
              <div className="flex flex-col items-center space-y-3 text-blue-100">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-orange-500/20 rounded-full flex items-center justify-center border border-orange-400/30">
                  <Shield className="w-8 h-8 text-orange-400" />
                </div>
                <span className="text-sm font-medium">Secure</span>
              </div>
              <div className="flex flex-col items-center space-y-3 text-blue-100">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-orange-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                  <BookOpen className="w-8 h-8 text-blue-400" />
                </div>
                <span className="text-sm font-medium">Efficient</span>
              </div>
              <div className="flex flex-col items-center space-y-3 text-blue-100">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-orange-500/20 rounded-full flex items-center justify-center border border-orange-400/30">
                  <Zap className="w-8 h-8 text-orange-400" />
                </div>
                <span className="text-sm font-medium">Fast</span>
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          <div className="mb-6">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
              <span className="text-blue-200 text-lg font-medium">Loading your library...</span>
            </div>
            
            {/* Animated dots */}
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>

          {/* Version info */}
          <div className="text-sm text-blue-300/70 space-y-1">
            <div className="font-semibold text-orange-300">Professional Edition v1.0.0</div>
            <div 
              className="text-blue-300/60 cursor-pointer hover:text-blue-200 transition-colors"
              onClick={onShowCopyright}
            >
              © 2025 Tamnet Systems
            </div>
          </div>
        </div>
      )}

      {/* Fallback logo if image doesn't load */}
      {!logoLoaded && phase === 'logo' && (
        <div className="text-center">
          <div className="w-52 h-52 mx-auto bg-gradient-to-br from-blue-500 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl">
            <span className="text-6xl font-bold text-white">T</span>
          </div>
        </div>
      )}

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-orange-500/10 to-transparent rounded-br-full"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tl-full"></div>
    </div>
  );
}
