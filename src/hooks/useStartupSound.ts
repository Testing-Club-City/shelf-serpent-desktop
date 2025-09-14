import { useEffect, useRef } from 'react';

export function useStartupSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Create a professional startup sound using Web Audio API
    const createStartupSound = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        // Resume audio context if suspended (required by browsers)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const playChord = (frequencies: number[], duration: number, delay: number = 0) => {
          setTimeout(() => {
            frequencies.forEach((frequency, index) => {
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
              oscillator.type = 'sine';
              
              // Smooth fade in and out with lower volume
              const baseVolume = 0.025; // Even more subtle volume
              gainNode.gain.setValueAtTime(0, audioContext.currentTime);
              gainNode.gain.linearRampToValueAtTime(baseVolume * (1 - index * 0.1), audioContext.currentTime + 0.15);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + duration);
            });
          }, delay);
        };

        // Extended professional startup chord progression
        playChord([261.63, 329.63, 392.00], 1.4, 0);     // C4, E4, G4
        playChord([329.63, 415.30, 493.88], 1.2, 500);   // E4, G#4, B4
        playChord([392.00, 493.88, 587.33], 1.0, 1000);  // G4, B4, D5
        playChord([523.25, 659.25, 783.99], 1.8, 1500);  // C5, E5, G5 (final chord)
        
      } catch (error) {
        console.log('Audio context not available:', error);
      }
    };

    // Play sound with a small delay to ensure component is mounted
    const timer = setTimeout(() => {
      createStartupSound();
    }, 600);

    return () => {
      clearTimeout(timer);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return null;
}
