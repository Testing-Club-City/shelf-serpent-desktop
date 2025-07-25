
import { useUserPresence } from '@/hooks/useUserPresence';

interface LayoutProps {
  children: React.ReactNode
}

// Always use useUserPresence so every user's presence is tracked
export const Layout = ({ children }: LayoutProps) => {
  useUserPresence(); // No need to use the returned data in Layout

  return (
    <div className="h-full">
      {children}
    </div>
  )
}
