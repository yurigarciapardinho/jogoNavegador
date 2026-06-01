import React, { useEffect, useRef, useState } from 'react'
import { MotorMapa } from '../game/MotorMapa'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function TelaMapa() {
    const refContainer = useRef<HTMLDivElement>(null)
    const refMotor = useRef<MotorMapa | null>(null)
    const { token, usuario, adicionarNotificacao, dadosAldeia, serverSpeed } = usarEstadoJogo()
    
    const [aldeiaSelecionada, definirAldeiaSelecionada] = useState<any | null>(null)
    const [abaAtiva, definirAbaAtiva] = useState<'info' | 'atacar' | 'apoiar'>('info')
    
    const [qtdLanceiro, definirQtdLanceiro] = useState(0)
    const [qtdEspadachim, definirQtdEspadachim] = useState(0)
    const [qtdBarbaro, definirQtdBarbaro] = useState(0)

    const [unidadesOrigem, definirUnidadesOrigem] = useState({ lanceiro: 0, espadachim: 0, barbaro: 0 })
    const [idAldeiaOrigem, definirIdAldeiaOrigem] = useState<string | null>(null)
    
    // UI Busca
    const [buscaCoords, definirBuscaCoords] = useState({ x: '', y: '' })
    const [buscaNome, definirBuscaNome] = useState('')

    const focarMapa = (x: number, y: number) => {
        if (refMotor.current) refMotor.current.focarNaCoordenada(x, y)
    }

    const buscarPorCoordenadas = () => {
        const nx = parseInt(buscaCoords.x)
        const ny = parseInt(buscaCoords.y)
        if (!isNaN(nx) && !isNaN(ny)) focarMapa(nx, ny)
    }

    const buscarPorNome = async () => {
        const termoBusca = buscaNome.trim()
        if (!termoBusca) return
        try {
            const res = await api.get(`/map/search?q=${encodeURIComponent(termoBusca)}`, token)
            if (res.x !== undefined && res.y !== undefined) {
                focarMapa(res.x, res.y)
            }
        } catch (e: any) {
            adicionarNotificacao(e.message || 'Aldeia não encontrada.', 'erro')
        }
    }
    
    // Buscar tropas ativas do jogador para validar limite
    useEffect(() => {
        let estaMontado = true
        if (token && usuario) {
            api.get('/me/villages', token)
            .then(dados => {
                usarEstadoJogo.getState().definirDerrota(dados.isDefeated || false)
                if (estaMontado && dados.villages && dados.villages.length > 0) {
                    definirIdAldeiaOrigem(dados.villages[0].id)
                    if (dados.villages[0].units) {
                        definirUnidadesOrigem({
                            lanceiro: dados.villages[0].units.spear || 0,
                            espadachim: dados.villages[0].units.sword || 0,
                            barbaro: dados.villages[0].units.axe || 0
                        })
                    }
                }
            })
            .catch(() => adicionarNotificacao('Erro ao carregar dados da sua aldeia no mapa.', 'erro'))
        }
        return () => { estaMontado = false }
    }, [token, usuario])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                const target = e.target as HTMLElement
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
                e.preventDefault()
                if (refMotor.current) {
                    refMotor.current.focarNaAldeiaAtiva()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        let foiCancelado = false;
        const motor = new MotorMapa((mensagemErro) => {
            if (!foiCancelado) adicionarNotificacao(mensagemErro, 'erro')
        });
        refMotor.current = motor;

        const iniciarPixi = async () => {
            if (!refContainer.current) return;
            
            await motor.inicializar(refContainer.current);

            // Se o React desmontou o componente enquanto inicializar() rodava, destrói IMEDIATAMENTE após terminar.
            if (foiCancelado) {
                motor.destruir();
                if (refMotor.current === motor) refMotor.current = null;
            } else {
                if (token && usuario) {
                    motor.carregarAldeias(token, usuario.id, (aldeia) => {
                        if (!foiCancelado) {
                            definirAldeiaSelecionada(aldeia)
                            definirAbaAtiva('info')
                        }
                    })
                }
            }
        };

        iniciarPixi();

        // Cleanup do React
        return () => {
            foiCancelado = true;
            
            // Se já terminou de inicializar, pode destruir agora.
            if (motor.estaInicializado) {
                motor.destruir();
                if (refMotor.current === motor) refMotor.current = null;
            }
            
            // Limpeza forçada do container para o Vite HMR
            if (refContainer.current) {
                refContainer.current.innerHTML = '';
            }
        };
    }, [token, usuario])

    const enviarMovimento = async (tipo: 'ATTACK' | 'SUPPORT') => {
        if (!idAldeiaOrigem) return
        
        if (qtdLanceiro + qtdEspadachim + qtdBarbaro <= 0) {
            adicionarNotificacao('Envie pelo menos uma tropa!', 'erro')
            return
        }

        try {
            await api.post('/village/attack', {
                originId: idAldeiaOrigem,
                targetId: aldeiaSelecionada.id,
                spear: qtdLanceiro,
                sword: qtdEspadachim,
                axe: qtdBarbaro
            }, token)

            adicionarNotificacao(`${tipo === 'ATTACK' ? 'Ataque' : 'Apoio'} enviado com sucesso!`, 'sucesso')
            definirAldeiaSelecionada(null)
            definirQtdLanceiro(0)
            definirQtdEspadachim(0)
            definirQtdBarbaro(0)
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar movimento de tropas.', 'erro')
        }
    }

    const formatarSegundos = (ms: number) => {
        const totalSegundos = Math.floor(ms / 1000)
        const horas = Math.floor(totalSegundos / 3600)
        const minutos = Math.floor((totalSegundos % 3600) / 60)
        const segs = totalSegundos % 60
        return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
    }

    const calcularTempoMarchaInfo = () => {
        if (!dadosAldeia || !aldeiaSelecionada) return '--:--:--'
        const dx = aldeiaSelecionada.x - dadosAldeia.x
        const dy = aldeiaSelecionada.y - dadosAldeia.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        let ms = Math.round((distance * 1080 * 1000) / serverSpeed) // Base de 18 min
        if (aldeiaSelecionada.userId === null) {
            ms = Math.round(ms / 5)
        }
        return formatarSegundos(ms)
    }

    const calcularTempoMarchaDinamico = () => {
        if (!dadosAldeia || !aldeiaSelecionada) return '--:--:--'
        const dx = aldeiaSelecionada.x - dadosAldeia.x
        const dy = aldeiaSelecionada.y - dadosAldeia.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        let maxSpeed = 0
        if (qtdLanceiro > 0) maxSpeed = Math.max(maxSpeed, 1080)
        if (qtdEspadachim > 0) maxSpeed = Math.max(maxSpeed, 1320)
        if (qtdBarbaro > 0) maxSpeed = Math.max(maxSpeed, 1080)
        
        if (maxSpeed === 0) return '--:--:--'
        
        let ms = Math.round((distance * maxSpeed * 1000) / serverSpeed)
        
        if (aldeiaSelecionada.userId === null) {
            ms = Math.round(ms / 5)
        }

        return formatarSegundos(ms)
    }

    return (
        <section className="telaMapa">
            <div ref={refContainer} className="telaMapa_containerPixi" onContextMenu={(e) => e.preventDefault()} />
            
            <div className="mapaUI_busca">
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Buscar por Coordenada</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="number" placeholder="X" value={buscaCoords.x} onChange={e => definirBuscaCoords({...buscaCoords, x: e.target.value})} />
                    <input type="number" placeholder="Y" value={buscaCoords.y} onChange={e => definirBuscaCoords({...buscaCoords, y: e.target.value})} />
                    <button onClick={buscarPorCoordenadas} className="botaoGeral botaoGeral--primario" style={{ padding: '4px' }}>Ir</button>
                </div>
                
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginTop: '8px' }}>Buscar por Nome</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" placeholder="Nome" value={buscaNome} onChange={e => definirBuscaNome(e.target.value)} />
                    <button onClick={buscarPorNome} className="botaoGeral botaoGeral--primario" style={{ padding: '4px' }}>Ir</button>
                </div>
            </div>

            <div className="telaMapa_dicaFlutuante">
                <p>Pressione e arraste para mover o mapa. Clique em uma aldeia para interagir.</p>
            </div>

            <div className="rosaDosVentos"></div>

            {aldeiaSelecionada && (
                <div className="modalFundo animarSurgimento">
                    <div className="modalConteudo">
                        <div className="modalCabecalho">
                            <h2 className="modalTitulo">{aldeiaSelecionada.name}</h2>
                            <button onClick={() => definirAldeiaSelecionada(null)} className="botaoGeral botaoGeral--secundario" style={{ padding: '4px 8px' }}>✕</button>
                        </div>
                        
                        <div className="abasNavegacao">
                            <button 
                                onClick={() => definirAbaAtiva('info')} 
                                className={`botaoGeral ${abaAtiva === 'info' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                            >
                                Informação
                            </button>
                            {aldeiaSelecionada.userId !== usuario?.id && usuario?.role !== 'ADMIN' && (
                                <>
                                    <button 
                                        onClick={() => definirAbaAtiva('atacar')} 
                                        className={`botaoGeral ${abaAtiva === 'atacar' ? 'botaoGeral--perigo' : 'botaoGeral--secundario'}`}
                                    >
                                        Atacar
                                    </button>
                                    <button 
                                        onClick={() => definirAbaAtiva('apoiar')} 
                                        className={`botaoGeral ${abaAtiva === 'apoiar' ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                                    >
                                        Apoiar
                                    </button>
                                </>
                            )}
                        </div>

                        {abaAtiva === 'info' && (
                            <div className="campoGrupo" style={{ marginTop: 'var(--espacamentoMedio)' }}>
                                <p className="campoRotulo">Jogador: <span style={{ color: 'var(--corTextoPrincipal)', fontWeight: 'bold' }}>{aldeiaSelecionada.username || (aldeiaSelecionada.userId ? 'Desconhecido' : 'Aldeia Bárbara (NPC)')}</span></p>
                                <p className="campoRotulo">Pontuação: <span style={{ color: 'var(--corTextoPrincipal)' }}>{aldeiaSelecionada.points?.toLocaleString() || 0} pts</span></p>
                                <p className="campoRotulo">Coordenadas: <span style={{ color: 'var(--corTextoPrincipal)' }}>{aldeiaSelecionada.x} | {aldeiaSelecionada.y}</span></p>
                                <p className="campoRotulo">Tempo Base: <span style={{ color: 'var(--corTextoSecundario)' }}>~ {calcularTempoMarchaInfo()}</span></p>
                                
                                {aldeiaSelecionada.userId === null && (
                                    <p className="textoDestaque" style={{ cursor: 'default', marginTop: '8px' }}>Dica: Aldeias Bárbaras são alvos fáceis para farmar recursos no início do jogo!</p>
                                )}
                            </div>
                        )}

                        {(abaAtiva === 'atacar' || abaAtiva === 'apoiar') && (
                            <div style={{ marginTop: 'var(--espacamentoMedio)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espacamentoMedio)' }}>
                                    <p className="campoRotulo" style={{ margin: 0 }}>Selecione as tropas:</p>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--corAviso)', fontWeight: 'bold' }}>
                                        ⏱ {calcularTempoMarchaDinamico()}
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { id: 'lanceiro', nome: 'Lanceiro', max: unidadesOrigem.lanceiro, val: qtdLanceiro, setVal: definirQtdLanceiro },
                                        { id: 'espadachim', nome: 'Espadachim', max: unidadesOrigem.espadachim, val: qtdEspadachim, setVal: definirQtdEspadachim },
                                        { id: 'barbaro', nome: 'Bárbaro', max: unidadesOrigem.barbaro, val: qtdBarbaro, setVal: definirQtdBarbaro }
                                    ].map(tropa => (
                                        <div key={tropa.id} className="tropaLinha">
                                            <div className="tropaCabecalho">
                                                <div className="tropaNome">{tropa.nome}</div>
                                                <div className="tropaInfo">
                                                    <div>Casa: {tropa.max}</div>
                                                    <div style={{ color: tropa.val > 0 ? 'var(--corSucesso)' : 'inherit' }}>Enviado: {tropa.val}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="tropaCorpo">
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max={tropa.max} 
                                                    value={tropa.val} 
                                                    onChange={e => tropa.setVal(Math.min(tropa.max, Math.max(0, Number(e.target.value))))} 
                                                    className="tropaSliderControle" 
                                                />
                                                
                                                <div className="tropaAcoes">
                                                    <button className="tropaBotaoMax" onClick={() => tropa.setVal(tropa.max)}>MAX</button>
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        max={tropa.max} 
                                                        value={tropa.val} 
                                                        onChange={e => tropa.setVal(Math.min(tropa.max, Math.max(0, Number(e.target.value))))} 
                                                        className="tropaInputNumero" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button 
                                    onClick={() => enviarMovimento(abaAtiva === 'atacar' ? 'ATTACK' : 'SUPPORT')}
                                    className={`botaoGeral botaoGeral--largo ${abaAtiva === 'atacar' ? 'botaoGeral--perigo' : 'botaoGeral--sucesso'}`}
                                >
                                    Enviar {abaAtiva === 'atacar' ? 'Ataque' : 'Apoio'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    )
}
