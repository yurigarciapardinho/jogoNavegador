import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'
import { CheckCircle, Gift, Info, X } from 'lucide-react'

export const PainelMissoes: React.FC<{ aoAtualizar: () => void }> = ({ aoAtualizar }) => {
    const { token, adicionarNotificacao, dadosAldeia } = usarEstadoJogo()
    const [missoes, definirMissoes] = useState<any[]>([])
    const [carregando, definirCarregando] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const modalRef = useRef<HTMLDivElement>(null)

    // Lógica Drag and Drop
    const [posicao, definirPosicao] = useState({ x: -100, y: -100 }) // Inicial fora da tela para evitar flicker
    const isDragging = useRef(false)
    const hasMoved = useRef(false)
    const startPos = useRef({ x: 0, y: 0 })

    const buscarMissoes = async () => {
        try {
            const resp = await api.get('/quests', token || '')
            if (resp && resp.quests) {
                definirMissoes(resp.quests)
            }
        } catch (e: any) {
            console.error('Erro ao buscar missões', e)
        }
    }

    useEffect(() => {
        if (token) buscarMissoes()
    }, [token, dadosAldeia])

    useEffect(() => {
        // Carrega posição do cache
        const posSalva = localStorage.getItem('kast_missao_pos')
        if (posSalva) {
            try {
                const parsed = JSON.parse(posSalva)
                // Ajusta limites se a janela encolheu
                const maxW = window.innerWidth - 60
                const maxH = window.innerHeight - 60
                definirPosicao({ 
                    x: Math.min(Math.max(0, parsed.x), maxW), 
                    y: Math.min(Math.max(0, parsed.y), maxH) 
                })
            } catch(e) {
                definirPosicao({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
            }
        } else {
            definirPosicao({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
        }
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const resgatarMissao = async (id: string) => {
        if (carregando) return
        definirCarregando(true)
        try {
            await api.post(`/quests/${id}/claim`, {}, token || '')
            adicionarNotificacao('Recompensa de missão coletada!', 'sucesso')
            await buscarMissoes()
            aoAtualizar()
        } catch (e: any) {
            adicionarNotificacao(e.message || 'Erro ao resgatar missão', 'erro')
        } finally {
            definirCarregando(false)
        }
    }

    // Eventos de Pointer para Drag
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return // Apenas botão esquerdo
        e.currentTarget.setPointerCapture(e.pointerId)
        
        isDragging.current = true
        hasMoved.current = false
        startPos.current = {
            x: e.clientX - posicao.x,
            y: e.clientY - posicao.y
        }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging.current) return
        
        if (!hasMoved.current) {
            const dx = e.clientX - (startPos.current.x + posicao.x)
            const dy = e.clientY - (startPos.current.y + posicao.y)
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved.current = true
            }
        }
        
        if (hasMoved.current) {
            let novaX = e.clientX - startPos.current.x
            let novaY = e.clientY - startPos.current.y
            
            novaX = Math.max(0, Math.min(window.innerWidth - 60, novaX))
            novaY = Math.max(0, Math.min(window.innerHeight - 60, novaY))

            definirPosicao({ x: novaX, y: novaY })
        }
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!isDragging.current) return
        isDragging.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        
        if (hasMoved.current) {
            localStorage.setItem('kast_missao_pos', JSON.stringify(posicao))
        } else {
            setIsOpen(true)
        }
        hasMoved.current = false
    }

    const missoesPendentes = missoes.filter(m => !m.claimed)
    const prontasParaResgate = missoesPendentes.filter(m => m.completed)
    const incompletas = missoesPendentes.filter(m => !m.completed)
    const missoesOrdenadas = [...prontasParaResgate, ...incompletas]

    if (missoesPendentes.length === 0) return null

    return (
        <>
            <button 
                className="widgetMissoes_gatilho"
                style={{ 
                    left: `${posicao.x}px`, 
                    top: `${posicao.y}px`,
                    opacity: posicao.x === -100 ? 0 : 1
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                aria-label="Abrir painel de missões (arrastável)"
                aria-expanded={isOpen}
            >
                <Gift size={28} aria-hidden="true" />
                {prontasParaResgate.length > 0 && (
                    <span className="widgetMissoes_badge" aria-label={`${prontasParaResgate.length} missões concluídas prontas para resgate`}>
                        {prontasParaResgate.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div 
                    className="modalMissoes_overlay" 
                    role="dialog" 
                    aria-modal="true" 
                    aria-labelledby="modal-missoes-titulo"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsOpen(false)
                    }}
                >
                    <div className="modalMissoes_conteudo" ref={modalRef}>
                        <div className="modalMissoes_cabecalho">
                            <h2 id="modal-missoes-titulo" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--corSucesso)', fontSize: '1.25rem' }}>
                                <Gift size={24} aria-hidden="true" /> Missões Ativas
                            </h2>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="botaoFecharNotificacao"
                                aria-label="Fechar missões"
                            >
                                <X size={24} aria-hidden="true" />
                            </button>
                        </div>
                        
                        <div className="modalMissoes_corpo">
                            {missoesOrdenadas.map(missao => {
                                const isEpic = missao.id === 'Q_EXPANSION';
                                const style = { 
                                    background: missao.completed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.3)', 
                                    padding: '16px', 
                                    borderRadius: '8px', 
                                    display: 'flex', 
                                    flexDirection: 'column' as const, 
                                    gap: '12px',
                                    border: missao.completed 
                                        ? '1px solid rgba(16, 185, 129, 0.4)' 
                                        : isEpic 
                                            ? '1px solid rgba(234, 179, 8, 0.5)' 
                                            : '1px solid rgba(255,255,255,0.05)',
                                    boxShadow: isEpic && !missao.completed ? '0 0 15px rgba(234, 179, 8, 0.1)' : 'none'
                                };
                                return (
                                <div key={missao.id} style={style}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: isEpic ? '#fde047' : 'white' }}>
                                                {isEpic ? '👑 ' : ''}{missao.title}
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--corTextoSecundario)' }}>{missao.description}</p>
                                        </div>
                                        <div>
                                            {missao.completed ? (
                                                <button 
                                                    onClick={() => resgatarMissao(missao.id)}
                                                    disabled={carregando}
                                                    className="botaoGeral botaoGeral--sucesso"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                                                >
                                                    <CheckCircle size={18} aria-hidden="true" /> Resgatar
                                                </button>
                                            ) : (
                                                <div style={{ color: 'var(--corTextoSecundario)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                    <Info size={16} aria-hidden="true" /> Incompleta
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {isEpic ? (
                                        <div style={{ color: '#fde047', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                            Recompensa: Fundação da Segunda Aldeia
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <span className="pillRecompensa" title="Madeira">
                                                <span aria-hidden="true">🪵</span> <span style={{ color: '#d97706' }}>{missao.rewards.wood}</span>
                                            </span>
                                            <span className="pillRecompensa" title="Argila">
                                                <span aria-hidden="true">🧱</span> <span style={{ color: '#ea580c' }}>{missao.rewards.clay}</span>
                                            </span>
                                            <span className="pillRecompensa" title="Ferro">
                                                <span aria-hidden="true">⚒️</span> <span style={{ color: '#94a3b8' }}>{missao.rewards.iron}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
