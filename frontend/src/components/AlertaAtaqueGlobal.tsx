import React, { useState, useEffect, useRef } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function AlertaAtaqueGlobal() {
    const { dadosAldeia, definirTela } = usarEstadoJogo()
    const [ataquesIgnorados, setAtaquesIgnorados] = useState(0)
    
    // Drag and drop state
    const [posicao, setPosicao] = useState({ x: 0, y: 0 })
    const [arrastando, setArrastando] = useState(false)
    const refPosMouse = useRef({ x: 0, y: 0 })

    const ataquesChegando = (dadosAldeia?.movementsTarget || []).filter((m: any) => m.type === 'ATTACK')
    const totalAtaques = ataquesChegando.length

    useEffect(() => {
        if (totalAtaques > ataquesIgnorados && ataquesIgnorados > 0) {
            setAtaquesIgnorados(0)
        }
    }, [totalAtaques, ataquesIgnorados])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!arrastando) return
            const deltaX = e.clientX - refPosMouse.current.x
            const deltaY = e.clientY - refPosMouse.current.y
            
            setPosicao(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
            refPosMouse.current = { x: e.clientX, y: e.clientY }
        }

        const handleMouseUp = () => {
            if (arrastando) setArrastando(false)
        }

        if (arrastando) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [arrastando])

    if (totalAtaques === 0 || (ataquesIgnorados > 0 && totalAtaques <= ataquesIgnorados)) return null

    const iniciarArraste = (e: React.MouseEvent) => {
        e.stopPropagation()
        setArrastando(true)
        refPosMouse.current = { x: e.clientX, y: e.clientY }
    }

    const aoClicarAlerta = () => {
        if (arrastando) return
        definirTela('aldeia')
        setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }, 100)
    }

    const fecharAlerta = (e: React.MouseEvent) => {
        e.stopPropagation()
        const confirmar = window.confirm("Tem certeza que quer remover o alerta de perigo? ele só voltará a aparecer se um novo ataque for enviado")
        if (confirmar) {
            setAtaquesIgnorados(totalAtaques)
        }
    }

    return (
        <div 
            className={`alertaAtaqueGlobal ${!arrastando ? 'pulse-anim' : ''} ${arrastando ? 'alertaAtaqueGlobal--arrastando' : ''}`} 
            style={{ transform: `translate(${posicao.x}px, ${posicao.y}px)` }}
        >
            <div className="alertaAtaqueGlobal_icone" onMouseDown={iniciarArraste} title="Arraste para mover">⚔️</div>
            <div className="alertaAtaqueGlobal_texto" onClick={aoClicarAlerta} title="Ver ataques">
                <strong>ALERTA DE ATAQUE</strong>
                <span>{totalAtaques} ataque{totalAtaques > 1 ? 's' : ''} a caminho</span>
            </div>
            <button className="alertaAtaqueGlobal_fechar" onClick={fecharAlerta} title="Ignorar alerta">✕</button>
        </div>
    )
}
