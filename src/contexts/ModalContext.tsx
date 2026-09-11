import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export interface ModalLayerInfo {
  zIndex: number;
  isTopmost: boolean;
  stackIndex: number;
}

interface ModalItem {
  id: string;
  onClose: () => void;
}

interface ModalContextValue {
  registerModal: (id: string, onClose: () => void) => void;
  unregisterModal: (id: string) => void;
  getModalLayer: (id: string) => ModalLayerInfo;
  popTopModal: () => boolean;
  modalStack: ModalItem[];
}

const BASE_MODAL_Z_INDEX = 100;
const Z_INDEX_STEP = 20;

const ModalContext = createContext<ModalContextValue | null>(null);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalStack, setModalStack] = useState<ModalItem[]>([]);
  const stackRef = useRef<ModalItem[]>([]);

  // Keep ref in sync with state for immediate synchronous access in event handlers
  useEffect(() => {
    stackRef.current = modalStack;
  }, [modalStack]);

  const registerModal = useCallback((id: string, onClose: () => void) => {
    setModalStack((prev) => {
      // Check if modal is already in stack
      const existingIdx = prev.findIndex((m) => m.id === id);
      if (existingIdx !== -1) {
        // Update onClose callback while preserving or moving to top if re-opened
        const updated = [...prev];
        updated[existingIdx] = { id, onClose };
        return updated;
      }
      return [...prev, { id, onClose }];
    });
  }, []);

  const unregisterModal = useCallback((id: string) => {
    setModalStack((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getModalLayer = useCallback(
    (id: string): ModalLayerInfo => {
      const idx = modalStack.findIndex((m) => m.id === id);
      if (idx === -1) {
        // Fallback for initial render before registration effect runs
        const stackLen = modalStack.length;
        return {
          zIndex: BASE_MODAL_Z_INDEX + stackLen * Z_INDEX_STEP,
          isTopmost: true,
          stackIndex: stackLen,
        };
      }
      return {
        zIndex: BASE_MODAL_Z_INDEX + idx * Z_INDEX_STEP,
        isTopmost: idx === modalStack.length - 1,
        stackIndex: idx,
      };
    },
    [modalStack]
  );

  const popTopModal = useCallback((): boolean => {
    const currentStack = stackRef.current;
    if (currentStack.length > 0) {
      const topModal = currentStack[currentStack.length - 1];
      if (topModal && typeof topModal.onClose === 'function') {
        topModal.onClose();
        return true;
      }
    }
    return false;
  }, []);

  return (
    <ModalContext.Provider
      value={{
        registerModal,
        unregisterModal,
        getModalLayer,
        popTopModal,
        modalStack,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModalContext = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return ctx;
};

/**
 * Hook to automatically register and manage layering for a modal
 */
export function useModalLayer(id: string, isOpen: boolean, onClose: () => void): ModalLayerInfo {
  const { registerModal, unregisterModal, getModalLayer } = useModalContext();

  useEffect(() => {
    if (isOpen) {
      registerModal(id, onClose);
      return () => {
        unregisterModal(id);
      };
    }
  }, [id, isOpen, onClose, registerModal, unregisterModal]);

  return getModalLayer(id);
}

/**
 * Safe Portal Wrapper to guarantee modals render in document.body
 * avoiding CSS stacking-context traps (transforms, filters, overflow)
 */
export const ModalPortal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};
