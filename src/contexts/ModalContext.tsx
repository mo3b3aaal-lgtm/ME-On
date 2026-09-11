import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
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

const BASE_MODAL_Z_INDEX = 1000;
const Z_INDEX_STEP = 50;

const ModalContext = createContext<ModalContextValue | null>(null);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalStack, setModalStack] = useState<ModalItem[]>([]);
  const stackRef = useRef<ModalItem[]>([]);

  // Keep stackRef in sync immediately with state for event handlers & synchronous queries
  useEffect(() => {
    stackRef.current = modalStack;
  }, [modalStack]);

  const registerModal = useCallback((id: string, onClose: () => void) => {
    setModalStack((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === id);
      if (existingIdx !== -1) {
        // Modal is already present in the stack at existingIdx.
        // Update its onClose callback while strictly preserving its original stack index.
        const updated = [...prev];
        updated[existingIdx] = { id, onClose };
        return updated;
      }
      // Newly opened modal: append to the top of the stack
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
        // Fallback for initial render before registration effect executes:
        // Modal is opening on top of the current stack
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
 * Hook to automatically register and manage layering for a modal.
 * Uses a ref for onClose to ensure re-renders of the parent component
 * do NOT trigger effect cleanup or re-shuffle the modal's stack position.
 */
export function useModalLayer(id: string, isOpen: boolean, onClose: () => void): ModalLayerInfo {
  const { registerModal, unregisterModal, getModalLayer } = useModalContext();

  const onCloseRef = useRef(onClose);
  // Keep the ref updated with latest onClose callback on every render
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  // Only run registration/unregistration when id or isOpen changes
  useEffect(() => {
    if (isOpen) {
      registerModal(id, () => {
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      });
      return () => {
        unregisterModal(id);
      };
    }
  }, [id, isOpen, registerModal, unregisterModal]);

  return getModalLayer(id);
}

/**
 * Safe Portal Wrapper to guarantee modals render directly in document.body
 * avoiding CSS stacking-context traps (transforms, filters, overflow)
 */
export const ModalPortal: React.FC<{ children: ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(children, document.body);
};
