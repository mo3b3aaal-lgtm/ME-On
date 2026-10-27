import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
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

export interface ModalActionsValue {
  registerModal: (id: string, onClose: () => void) => void;
  unregisterModal: (id: string) => void;
  getModalLayer: (id: string) => ModalLayerInfo;
  popTopModal: () => boolean;
}

interface ModalContextValue extends ModalActionsValue {
  modalStack: ModalItem[];
}

interface InternalModalStore {
  actions: ModalActionsValue;
  getStack: () => ModalItem[];
  subscribe: (listener: () => void) => () => void;
}

const BASE_MODAL_Z_INDEX = 1000;
const Z_INDEX_STEP = 50;

const IDLE_MODAL_LAYER: ModalLayerInfo = Object.freeze({
  zIndex: BASE_MODAL_Z_INDEX,
  isTopmost: false,
  stackIndex: 0,
});

const NOOP_SUBSCRIBE = () => () => {};

function computeModalLayer(stack: ModalItem[], id: string): ModalLayerInfo {
  const idx = stack.findIndex((m) => m.id === id);
  if (idx === -1) {
    // Fallback for initial render before registration effect executes:
    // Modal is opening on top of the current stack
    const stackLen = stack.length;
    return {
      zIndex: BASE_MODAL_Z_INDEX + stackLen * Z_INDEX_STEP,
      isTopmost: true,
      stackIndex: stackLen,
    };
  }
  return {
    zIndex: BASE_MODAL_Z_INDEX + idx * Z_INDEX_STEP,
    isTopmost: idx === stack.length - 1,
    stackIndex: idx,
  };
}

const ModalStoreContext = createContext<InternalModalStore | null>(null);
const ModalContext = createContext<ModalContextValue | null>(null);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalStack, setModalStack] = useState<ModalItem[]>([]);
  const stackRef = useRef<ModalItem[]>(modalStack);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const notifyListeners = useCallback(() => {
    listenersRef.current.forEach((listener) => {
      listener();
    });
  }, []);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getStack = useCallback((): ModalItem[] => stackRef.current, []);

  const registerModal = useCallback(
    (id: string, onClose: () => void) => {
      const prev = stackRef.current;
      const existingIdx = prev.findIndex((m) => m.id === id);
      if (existingIdx !== -1) {
        if (prev[existingIdx].onClose === onClose) {
          return;
        }
        // Modal is already present in the stack at existingIdx.
        // Update its onClose callback while strictly preserving its original stack index.
        const updated = [...prev];
        updated[existingIdx] = { id, onClose };
        stackRef.current = updated;
        setModalStack(updated);
        notifyListeners();
        return;
      }
      // Newly opened modal: append to the top of the stack
      const updated = [...prev, { id, onClose }];
      stackRef.current = updated;
      setModalStack(updated);
      notifyListeners();
    },
    [notifyListeners]
  );

  const unregisterModal = useCallback(
    (id: string) => {
      const prev = stackRef.current;
      if (!prev.some((m) => m.id === id)) {
        return;
      }
      const updated = prev.filter((m) => m.id !== id);
      stackRef.current = updated;
      setModalStack(updated);
      notifyListeners();
    },
    [notifyListeners]
  );

  const getModalLayer = useCallback((id: string): ModalLayerInfo => {
    return computeModalLayer(stackRef.current, id);
  }, []);

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

  const actions = useMemo<ModalActionsValue>(
    () => ({
      registerModal,
      unregisterModal,
      getModalLayer,
      popTopModal,
    }),
    [registerModal, unregisterModal, getModalLayer, popTopModal]
  );

  const storeValue = useMemo<InternalModalStore>(
    () => ({
      actions,
      getStack,
      subscribe,
    }),
    [actions, getStack, subscribe]
  );

  const contextValue = useMemo<ModalContextValue>(
    () => ({
      registerModal,
      unregisterModal,
      getModalLayer,
      popTopModal,
      modalStack,
    }),
    [registerModal, unregisterModal, getModalLayer, popTopModal, modalStack]
  );

  return (
    <ModalStoreContext.Provider value={storeValue}>
      <ModalContext.Provider value={contextValue}>{children}</ModalContext.Provider>
    </ModalStoreContext.Provider>
  );
};

function useModalStore(): InternalModalStore {
  const store = useContext(ModalStoreContext);
  if (!store) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return store;
}

export const useModalContext = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return ctx;
};

/**
 * Returns referentially stable modal controller actions without subscribing
 * the caller to modalStack state updates.
 */
export const useModalActions = (): ModalActionsValue => {
  return useModalStore().actions;
};

/**
 * Subscribes only to whether at least one modal is currently registered in the stack.
 * Prevents root re-renders when nested modals open/close above an already-open modal.
 */
export const useHasOpenModals = (): boolean => {
  const store = useModalStore();
  const getHasOpenSnapshot = useCallback(() => store.getStack().length > 0, [store]);
  return useSyncExternalStore(store.subscribe, getHasOpenSnapshot, () => false);
};

/**
 * Hook to automatically register and manage layering for a modal.
 * Uses a ref for onClose to ensure re-renders of the parent component
 * do NOT trigger effect cleanup or re-shuffle the modal's stack position,
 * and subscribes selectively so closed or unaffected modals do not re-render.
 */
export function useModalLayer(id: string, isOpen: boolean, onClose: () => void): ModalLayerInfo {
  const store = useModalStore();
  const { registerModal, unregisterModal, getModalLayer } = store.actions;

  const onCloseRef = useRef(onClose);
  // Keep the ref updated with latest onClose callback on every render
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const handleClose = useCallback(() => {
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  }, []);

  // Only run registration/unregistration when id or isOpen changes
  useEffect(() => {
    if (isOpen) {
      registerModal(id, handleClose);
      return () => {
        unregisterModal(id);
      };
    }
  }, [id, isOpen, registerModal, unregisterModal, handleClose]);

  const cachedLayerRef = useRef<ModalLayerInfo>(IDLE_MODAL_LAYER);

  const subscribeToLayer = useMemo(
    () => (isOpen ? store.subscribe : NOOP_SUBSCRIBE),
    [isOpen, store]
  );

  const getLayerSnapshot = useCallback((): ModalLayerInfo => {
    if (!isOpen) {
      const prev = cachedLayerRef.current;
      if (!prev.isTopmost) {
        return prev;
      }
      // Preserve last active zIndex during exit transitions without staying topmost
      const closedSnapshot: ModalLayerInfo = {
        zIndex: prev.zIndex,
        isTopmost: false,
        stackIndex: prev.stackIndex,
      };
      cachedLayerRef.current = closedSnapshot;
      return closedSnapshot;
    }

    const next = getModalLayer(id);
    const prev = cachedLayerRef.current;
    if (
      prev.zIndex === next.zIndex &&
      prev.isTopmost === next.isTopmost &&
      prev.stackIndex === next.stackIndex
    ) {
      return prev;
    }
    cachedLayerRef.current = next;
    return next;
  }, [id, isOpen, getModalLayer]);

  return useSyncExternalStore(subscribeToLayer, getLayerSnapshot, () => IDLE_MODAL_LAYER);
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
