import React from 'react';
import { useAnimatedPresence } from '../../utils/motion';

export interface AnimatedPresenceProps {
  isOpen: boolean;
  children: React.ReactNode;
}

/**
 * Lazily mounts children when `isOpen` becomes true and retains them
 * strictly for the duration of the active reverse exit animation when closing.
 */
export const AnimatedPresence: React.FC<AnimatedPresenceProps> = ({ isOpen, children }) => {
  const { shouldRender } = useAnimatedPresence(isOpen);
  if (!shouldRender) return null;
  return <>{children}</>;
};

export default AnimatedPresence;
