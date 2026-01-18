import { useEffect } from 'react'

export function useAutoSave(projectId, activeFileName, code, triggerSave, isCodeLoading, isLoading) {
    useEffect(() => {
        if (!activeFileName || activeFileName.endsWith('/') || code === null) return
        if (isLoading || isCodeLoading) return
        if (typeof code !== 'string') return

        const handler = setTimeout(async () => {
            try {
                await triggerSave(code)
            } catch (err) {
                console.error('Auto-save failed:', err)
            }
        }, 1000)

        return () => clearTimeout(handler)
    }, [code, activeFileName, triggerSave, isCodeLoading, isLoading])
}
