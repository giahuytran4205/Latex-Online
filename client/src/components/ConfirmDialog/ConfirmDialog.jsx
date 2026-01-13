import { createContext, useContext, useState, useCallback } from 'react'
import './ConfirmDialog.css'

const ConfirmContext = createContext(null)

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider')
    }
    return context
}

export function ConfirmProvider({ children }) {
    const [dialog, setDialog] = useState(null)

    const confirm = useCallback((options) => {
        return new Promise((resolve) => {
            setDialog({
                title: options.title || 'Confirm',
                message: options.message || 'Are you sure?',
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                type: options.type || 'default', // 'default', 'danger', 'warning'
                onConfirm: () => {
                    setDialog(null)
                    resolve(true)
                },
                onCancel: () => {
                    setDialog(null)
                    resolve(false)
                }
            })
        })
    }, [])

    const close = useCallback(() => {
        if (dialog?.onCancel) {
            dialog.onCancel()
        }
    }, [dialog])

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {dialog && (
                <div className="confirm-overlay" onClick={close}>
                    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog__header">
                            <div className={`confirm-dialog__icon confirm-dialog__icon--${dialog.type}`}>
                                {dialog.type === 'danger' && (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                )}
                                {dialog.type === 'warning' && (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                )}
                                {dialog.type === 'default' && (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                )}
                            </div>
                            <h3>{dialog.title}</h3>
                        </div>
                        <div className="confirm-dialog__body">
                            <p>{dialog.message}</p>
                        </div>
                        <div className="confirm-dialog__footer">
                            <button
                                className="btn btn--secondary"
                                onClick={dialog.onCancel}
                            >
                                {dialog.cancelText}
                            </button>
                            <button
                                className={`btn ${dialog.type === 'danger' ? 'btn--danger' : 'btn--primary'}`}
                                onClick={dialog.onConfirm}
                            >
                                {dialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    )
}
