import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Shield, Zap } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);

  const steps = [
    'Initializing system components...',
    'Loading secure database...',
    'Establishing connections...',
    'Preparing user interface...',
    'Finalizing setup...',
    'System ready!'
  ];

  useEffect(() => {
    const duration = 5000; // 5 seconds total (extended by 1.5s)
    
    let currentStepIndex = 0;
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (duration / 50));
        
        // Update step based on progress
        const stepIndex = Math.floor((newProgress / 100) * steps.length);
        if (stepIndex !== currentStepIndex && stepIndex < steps.length) {
          currentStepIndex = stepIndex;
          setCurrentStep(steps[stepIndex]);
        }
        
        // Show features at 60% progress
        if (newProgress >= 60 && !showFeatures) {
          setShowFeatures(true);
        }
        
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 800);
          return 100;
        }
        
        return newProgress;
      });
    }, 50);

    // Set initial step
    setCurrentStep(steps[0]);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center z-50 overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            animation: 'pulse 3s ease-in-out infinite'
          }}></div>
        </div>
        
        {/* Floating elements with Tamnet colors */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-orange-400 rounded-full animate-bounce opacity-70"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-orange-300 rounded-full animate-ping opacity-50"></div>
        <div className="absolute bottom-32 left-40 w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-orange-500 rounded-full animate-bounce opacity-40" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="text-center z-10 max-w-lg mx-auto px-8">
        {/* Logo with enhanced glow effect */}
        <div className="mb-8 animate-slide-in-top">
          <div className="relative inline-block">
            <img 
              src="/tamnet-logo.png" 
              alt="Tamnet Logo" 
              className="w-32 h-32 mx-auto mb-4 drop-shadow-2xl rounded-lg bg-white/95 p-3"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(0, 51, 255, 0.3))'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-orange-400 rounded-lg opacity-20 animate-ping"></div>
          </div>
        </div>

        {/* Main title with Tamnet brand colors */}
        <div className="mb-8 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-orange-200 bg-clip-text text-transparent mb-3 tracking-wide">
            Kisii School
          </h1>
          <h2 className="text-2xl font-semibold text-blue-100 mb-4 tracking-wide">
            Library Management System
          </h2>
          
          {/* Powered by section with Tamnet colors */}
          <div className="flex items-center justify-center gap-3 text-blue-100 mb-6">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-orange-500/20 px-4 py-2 rounded-full backdrop-blur-sm border border-orange-400/30">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium">Powered by Tamnet Systems</span>
            </div>
          </div>
        </div>

        {/* Feature highlights with brand colors */}
        {showFeatures && (
          <div className="mb-8 animate-fade-in-up grid grid-cols-3 gap-4 text-xs">
            <div className="flex flex-col items-center gap-1 text-blue-100 opacity-90">
              <Shield className="w-5 h-5 text-orange-400" />
              <span>Secure</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-blue-100 opacity-90">
              <BookOpen className="w-5 h-5 text-blue-300" />
              <span>Efficient</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-blue-100 opacity-90">
              <Zap className="w-5 h-5 text-orange-400" />
              <span>Fast</span>
            </div>
          </div>
        )}

        {/* Progress section with Tamnet brand colors */}
        <div className="mb-8 animate-fade-in-up" style={{animationDelay: '0.6s'}}>
          {/* Progress bar container */}
          <div className="relative w-full bg-blue-900/50 rounded-full h-3 mb-4 overflow-hidden backdrop-blur-sm border border-orange-400/20">
            {/* Background shimmer */}
            <div className="absolute inset-0 animate-shimmer"></div>
            
            {/* Progress bar with Tamnet colors */}
            <div 
              className="bg-gradient-to-r from-blue-500 via-orange-400 to-blue-500 h-full rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
          
          {/* Loading text with icon */}
          <div className="flex items-center justify-center gap-3 text-blue-100">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            <span className="text-sm font-medium tracking-wide">{currentStep}</span>
          </div>
          
          {/* Progress percentage */}
          <div className="mt-2 text-xs text-orange-300 font-mono">
            {Math.round(progress)}%
          </div>
        </div>

        {/* Version and copyright info with brand colors */}
        <div className="text-xs text-blue-200/80 space-y-1 animate-fade-in-up" style={{animationDelay: '0.9s'}}>
          <div className="font-semibold text-orange-300">Professional Edition v1.0.0</div>
          <div className="text-blue-300/60">© 2024 Tamnet Systems</div>
          <div className="text-blue-300/50 italic">Your strong partner in ICT</div>
        </div>
      </div>

      {/* Corner decorations with brand colors */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-br-full"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tl-full"></div>
    </div>
  );
}
