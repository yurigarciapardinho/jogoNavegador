import React, { useEffect, useRef, useState } from 'react'
import { MotorMapa } from '../game/MotorMapa'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'
import { obterCapacidadeArmazem } from '../constantes/constantesJogo'

export default function TelaMapa() {
    const refContainer = useRef<HTMLDivElement>(null)
    const refMotor = useRef<MotorMapa | null>(null)
    const { token, usuario, adicionarNotificacao, dadosAldeia, serverSpeed, trocarAldeiaAtiva, userVillages } = usarEstadoJogo()
    
    const [aldeiaSelecionada, definirAldeiaSelecionada] = useState<any | null>(null)
    const [abaAtiva, definirAbaAtiva] = useState<'info' | 'atacar' | 'apoiar' | 'mercado' | 'admin'>('info')
    
    const [qtdLanceiro, definirQtdLanceiro] = useState(0)
    const [qtdEspadachim, definirQtdEspadachim] = useState(0)
    const [qtdBarbaro, definirQtdBarbaro] = useState(0)

    const [qtdMadeira, definirQtdMadeira] = useState(0)
    const [qtdArgila, definirQtdArgila] = useState(0)
    const [qtdFerro, definirQtdFerro] = useState(0)

    // Utiliza dadosAldeia para origem
    const unidadesOrigem = {
        lanceiro: dadosAldeia?.units?.spear || 0,
        espadachim: dadosAldeia?.units?.sword || 0,
        barbaro: dadosAldeia?.units?.axe || 0
    }
    
    // UI Busca
    const [buscaCoords, definirBuscaCoords] = useState({ x: '', y: '' })
    const [buscaNome, definirBuscaNome] = useState('')

    // God Mode UI
    const [godModeAtivo, definirGodModeAtivo] = useState(false)
    const [modalCriacao, definirModalCriacao] = useState<{ show: boolean, x: number, y: number, type: 'barbarian' | 'player', ownerUsername: string, pattern: 'small' | 'medium' | 'large' } | null>(null)
    const [pesquisaUser, definirPesquisaUser] = useState('')

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
    
    // Buscar informações adicionais se necessário
    useEffect(() => {
        let estaMontado = true
        if (token && usuario) {
            api.get('/me/villages', token)
            .then(dados => {
                usarEstadoJogo.getState().definirDerrota(dados.isDefeated || false)
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
                    refMotor.current.redefinirZoom()
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
                            
                            // A aldeia ativa não muda mais automaticamente no clique,
                            // o usuário precisará clicar no botão 'Tornar Ativa' na aba Info.
                        }
                    })
                }
            }
        };

        iniciarPixi();

        // Configuração Inicial de Callbacks do God Mode
        motor.onVillageMoveCb = async (villageId, novoX, novoY) => {
            if (!token) return
            try {
                await api.put(`/admin/village/${villageId}/move`, { x: novoX, y: novoY }, token)
                adicionarNotificacao(`Aldeia movida para ${novoX}|${novoY}`, 'sucesso')
            } catch (err: any) {
                adicionarNotificacao(err.message || 'Erro ao mover (coordenada ocupada?)', 'erro')
                if (refMotor.current) refMotor.current.buscarChunks() // Força snap-back
            }
        }
        
        motor.onMapClickCb = (x, y) => {
            definirModalCriacao({
                show: true, x, y, type: 'barbarian', ownerUsername: '', pattern: 'medium'
            })
        }

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

    // Sincroniza estado de God Mode no motor
    useEffect(() => {
        if (refMotor.current) {
            refMotor.current.godModeEnabled = godModeAtivo
        }
    }, [godModeAtivo])

    // Sincroniza a aldeia ativa atual com o motor
    useEffect(() => {
        if (refMotor.current && dadosAldeia) {
            refMotor.current.definirAldeiaAtiva(dadosAldeia.x, dadosAldeia.y)
        }
    }, [dadosAldeia])

    const enviarMovimento = async (tipo: 'ATTACK' | 'SUPPORT' | 'TRANSFER') => {
        if (!dadosAldeia?.id) return
        
        if (qtdLanceiro + qtdEspadachim + qtdBarbaro <= 0) {
            adicionarNotificacao('Envie pelo menos uma tropa!', 'erro')
            return
        }

        try {
            const endpoint = tipo === 'ATTACK' ? '/village/attack' : tipo === 'SUPPORT' ? '/village/support' : '/village/transfer'
            
            await api.post(endpoint, {
                originId: dadosAldeia.id,
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

    const enviarRecursos = async () => {
        if (!dadosAldeia?.id || !aldeiaSelecionada) return
        
        const wood = Math.floor(Math.max(0, typeof qtdMadeira === 'number' ? qtdMadeira : 0))
        const clay = Math.floor(Math.max(0, typeof qtdArgila === 'number' ? qtdArgila : 0))
        const iron = Math.floor(Math.max(0, typeof qtdFerro === 'number' ? qtdFerro : 0))

        if (wood + clay + iron <= 0) {
            adicionarNotificacao('Envie pelo menos um recurso!', 'erro')
            return
        }

        try {
            await api.post(`/village/${dadosAldeia.id}/market/send`, {
                targetId: aldeiaSelecionada.id,
                wood,
                clay,
                iron
            }, token)

            adicionarNotificacao('Recursos enviados com sucesso!', 'sucesso')
            definirAldeiaSelecionada(null)
            definirQtdMadeira(0)
            definirQtdArgila(0)
            definirQtdFerro(0)
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar recursos.', 'erro')
        }
    }

    const fundarAldeiaDeus = async () => {
        if (!modalCriacao) return
        try {
            await api.post('/admin/village/spawn-single', modalCriacao, token)
            adicionarNotificacao(`Aldeia criada em ${modalCriacao.x}|${modalCriacao.y}!`, 'sucesso')
            definirModalCriacao(null)
            if (refMotor.current) refMotor.current.buscarChunks()
        } catch (err: any) {
            adicionarNotificacao(err.message || 'Erro ao criar aldeia', 'erro')
        }
    }

    const deletarAldeiaDeus = async (id: string) => {
        if (!window.confirm("Apagar esta aldeia da face da terra?")) return
        try {
            await api.delete(`/admin/village/${id}`, token)
            adicionarNotificacao("Aldeia obliterada.", "sucesso")
            definirAldeiaSelecionada(null)
            if (refMotor.current) refMotor.current.buscarChunks()
        } catch (err: any) {
            adicionarNotificacao(err.message || 'Erro', 'erro')
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
                    <input type="number" placeholder="X" value={buscaCoords.x} onChange={e => definirBuscaCoords({...buscaCoords, x: e.target.value})} aria-label="Coordenada X" />
                    <input type="number" placeholder="Y" value={buscaCoords.y} onChange={e => definirBuscaCoords({...buscaCoords, y: e.target.value})} aria-label="Coordenada Y" />
                    <button onClick={buscarPorCoordenadas} className="botaoGeral botaoGeral--primario" style={{ padding: '4px' }}>Ir</button>
                </div>
                
                <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginTop: '8px' }}>Buscar por Nome</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" placeholder="Nome" value={buscaNome} onChange={e => definirBuscaNome(e.target.value)} aria-label="Nome da Aldeia" />
                    <button onClick={buscarPorNome} className="botaoGeral botaoGeral--primario" style={{ padding: '4px' }}>Ir</button>
                </div>
            </div>

            {usuario?.role === 'ADMIN' && (
                <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50, background: 'var(--corPainelBg)', padding: '8px 16px', border: '2px solid var(--corPrimariaHover)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <span style={{ color: 'var(--corTexto)', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem' }}>🛠️ Modo Editor</span>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={godModeAtivo} onChange={e => definirGodModeAtivo(e.target.checked)} style={{ transform: 'scale(1.5)', margin: 0, cursor: 'pointer' }} />
                    </label>
                </div>
            )}

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
                        
                        <div className="abasNavegacao" role="tablist">
                            <button 
                                role="tab"
                                aria-selected={abaAtiva === 'info'}
                                onClick={() => definirAbaAtiva('info')} 
                                className={`botaoGeral ${abaAtiva === 'info' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                            >
                                Informação
                            </button>
                            {aldeiaSelecionada.id !== dadosAldeia?.id && (
                                <>
                                    <button 
                                        role="tab"
                                        aria-selected={abaAtiva === 'atacar'}
                                        onClick={() => definirAbaAtiva('atacar')} 
                                        className={`botaoGeral ${abaAtiva === 'atacar' ? 'botaoGeral--perigo' : 'botaoGeral--secundario'}`}
                                    >
                                        Atacar
                                    </button>
                                    <button 
                                        role="tab"
                                        aria-selected={abaAtiva === 'apoiar'}
                                        onClick={() => definirAbaAtiva('apoiar')} 
                                        className={`botaoGeral ${abaAtiva === 'apoiar' ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                                    >
                                        Apoiar
                                    </button>
                                    {aldeiaSelecionada.userId === usuario?.id && (
                                        <button 
                                            role="tab"
                                            aria-selected={abaAtiva === 'transferir'}
                                            onClick={() => definirAbaAtiva('transferir')} 
                                            className={`botaoGeral ${abaAtiva === 'transferir' ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                                        >
                                            Transferir
                                        </button>
                                    )}
                                </>
                            )}
                            {aldeiaSelecionada.id !== dadosAldeia?.id && (
                                <button 
                                    role="tab"
                                    aria-selected={abaAtiva === 'mercado'}
                                    onClick={() => definirAbaAtiva('mercado')} 
                                    className={`botaoGeral ${abaAtiva === 'mercado' ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                                >
                                    Enviar Recursos
                                </button>
                            )}
                            {usuario?.role === 'ADMIN' && (
                                <button 
                                    role="tab"
                                    aria-selected={abaAtiva === 'admin'}
                                    onClick={() => definirAbaAtiva('admin')} 
                                    className={`botaoGeral ${abaAtiva === 'admin' ? 'botaoGeral--perigo' : 'botaoGeral--secundario'}`}
                                >
                                    Deus
                                </button>
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

                                {aldeiaSelecionada.userId === usuario?.id && aldeiaSelecionada.id !== dadosAldeia?.id && (
                                    <div style={{ marginTop: '16px' }}>
                                        <button 
                                            onClick={() => {
                                                trocarAldeiaAtiva(aldeiaSelecionada.id)
                                                adicionarNotificacao(`Aldeia ativa alterada para ${aldeiaSelecionada.name}`, 'sucesso')
                                            }}
                                            className="botaoGeral botaoGeral--primario botaoGeral--largo"
                                        >
                                            👁️ Tornar Aldeia Ativa
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {(abaAtiva === 'atacar' || abaAtiva === 'apoiar' || abaAtiva === 'transferir') && (
                            <div style={{ marginTop: 'var(--espacamentoMedio)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espacamentoMedio)' }}>
                                    <p className="campoRotulo" style={{ margin: 0 }}>Selecione as tropas:</p>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--corPrimariaHover)', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">⏱</span> {calcularTempoMarchaDinamico()}
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
                                                    aria-label={`Quantidade de ${tropa.nome} via controle deslizante`}
                                                />
                                                
                                                <div className="tropaAcoes">
                                                    <button className="tropaBotaoMax" onClick={() => tropa.setVal(tropa.max)} aria-label={`Enviar todos os ${tropa.nome}s`}>MAX</button>
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        max={tropa.max} 
                                                        value={tropa.val === 0 ? '' : tropa.val} 
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                                            tropa.setVal(isNaN(val) ? 0 : Math.min(tropa.max, Math.max(0, val)))
                                                        }} 
                                                        className="tropaInputNumero" 
                                                        aria-label={`Quantidade de ${tropa.nome}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button 
                                    onClick={() => enviarMovimento(abaAtiva === 'atacar' ? 'ATTACK' : abaAtiva === 'apoiar' ? 'SUPPORT' : 'TRANSFER')}
                                    className={`botaoGeral botaoGeral--largo ${abaAtiva === 'atacar' ? 'botaoGeral--perigo' : 'botaoGeral--sucesso'}`}
                                >
                                    Enviar {abaAtiva === 'atacar' ? 'Ataque' : abaAtiva === 'apoiar' ? 'Apoio' : 'Transferência'}
                                </button>
                            </div>
                        )}

                        {abaAtiva === 'mercado' && (() => {
                            const aldeiaDestinoStore = userVillages.find(v => v.id === aldeiaSelecionada?.id)
                            const maxCapArmazem = aldeiaDestinoStore?.buildings ? obterCapacidadeArmazem(aldeiaDestinoStore.buildings.warehouse || 1) : null

                            const nivelMercado = dadosAldeia?.buildings?.market || 0
                            const totalMercadores = nivelMercado > 0 ? Math.floor(Math.pow(1.15, nivelMercado - 1) * nivelMercado) : 0
                            const capacidadeTotal = totalMercadores * 1000

                            const inTransitOut = (dadosAldeia?.movementsOrigin || [])
                                .filter((m: any) => m.type === 'TRANSPORT')
                                .reduce((sum: number, t: any) => sum + (t.wood || 0) + (t.clay || 0) + (t.iron || 0), 0)

                            const inTransitReturn = (dadosAldeia?.movementsTarget || [])
                                .filter((m: any) => m.type === 'TRANSPORT_RETURN')
                                .reduce((sum: number, t: any) => sum + (t.wood || 0) + (t.clay || 0) + (t.iron || 0), 0)

                            const capacidadeDisponivel = Math.max(0, capacidadeTotal - (inTransitOut + inTransitReturn))
                            const totalSelecionado = (qtdMadeira || 0) + (qtdArgila || 0) + (qtdFerro || 0)
                            const corCapacidade = totalSelecionado > capacidadeDisponivel ? 'var(--corPerigo)' : 'var(--corSucesso)'

                            return (
                                <div style={{ marginTop: 'var(--espacamentoMedio)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <p className="campoRotulo" style={{ margin: 0 }}>Recursos a enviar:</p>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--corPrimariaHover)', fontWeight: 'bold' }}>
                                            <span aria-hidden="true">⏱</span> {calcularTempoMarchaInfo()}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espacamentoMedio)', padding: '8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--corTextoSecundario)' }}>
                                            Mercadores: <span style={{ fontWeight: 'bold', color: 'var(--corTextoPrincipal)' }}>{Math.floor(capacidadeDisponivel / 1000)} / {totalMercadores}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--corTextoSecundario)' }}>
                                            Carga: <span style={{ fontWeight: 'bold', color: corCapacidade }}>{totalSelecionado} / {capacidadeDisponivel}</span>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[
                                            { id: 'wood', nome: 'Madeira', val: qtdMadeira, setVal: definirQtdMadeira, max: dadosAldeia?.resources?.wood || 0, destRes: aldeiaDestinoStore?.resources?.wood || 0 },
                                            { id: 'clay', nome: 'Argila', val: qtdArgila, setVal: definirQtdArgila, max: dadosAldeia?.resources?.clay || 0, destRes: aldeiaDestinoStore?.resources?.clay || 0 },
                                            { id: 'iron', nome: 'Ferro', val: qtdFerro, setVal: definirQtdFerro, max: dadosAldeia?.resources?.iron || 0, destRes: aldeiaDestinoStore?.resources?.iron || 0 }
                                        ].map(res => {
                                            const limiteAlvo = maxCapArmazem !== null ? Math.max(0, Math.floor(maxCapArmazem - res.destRes)) : Infinity
                                            const outraCapacidadeUsada = (res.id === 'wood' ? 0 : qtdMadeira) + (res.id === 'clay' ? 0 : qtdArgila) + (res.id === 'iron' ? 0 : qtdFerro)
                                            const limiteMercador = Math.max(0, capacidadeDisponivel - outraCapacidadeUsada)
                                            const podeEnviarReal = Math.min(Math.floor(res.max), limiteAlvo, limiteMercador)
                                            return (
                                                <div key={res.id} className="tropaLinha">
                                                    <div className="tropaCabecalho">
                                                        <div className="tropaNome">{res.nome}</div>
                                                        <div className="tropaInfo">
                                                            <div>Estoque: {Math.floor(res.max)}</div>
                                                            {maxCapArmazem !== null && (
                                                                <div style={{ color: 'var(--corInfo)' }} title={`Capacidade do Armazém Alvo: ${maxCapArmazem}`}>
                                                                    Alvo: {Math.floor(limiteAlvo)}
                                                                </div>
                                                            )}
                                                            <div style={{ color: res.val > 0 ? 'var(--corSucesso)' : 'inherit' }}>Enviado: {res.val === 0 ? '0' : res.val}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="tropaCorpo">
                                                        <input 
                                                            type="range" 
                                                            min="0" 
                                                            max={podeEnviarReal} 
                                                            value={res.val === '' ? 0 : res.val} 
                                                            onChange={e => res.setVal(Math.min(podeEnviarReal, Math.max(0, parseInt(e.target.value) || 0)))} 
                                                            className="tropaSliderControle"
                                                        />
                                                        <div className="tropaAcoes">
                                                            <button className="tropaBotaoMax" onClick={() => res.setVal(podeEnviarReal)}>MAX</button>
                                                            <input 
                                                                type="number" 
                                                                min="0" 
                                                                max={podeEnviarReal} 
                                                                value={res.val === 0 ? '' : res.val} 
                                                                onChange={e => {
                                                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                                                    res.setVal(isNaN(val) ? 0 : Math.min(podeEnviarReal, Math.max(0, val)))
                                                                }} 
                                                                className="tropaInputNumero" 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--corTextoSecundario)', marginTop: '8px', marginBottom: '16px' }}>
                                    Certifique-se de que o Mercado da aldeia origem suporta este transporte.
                                </div>
                                    <button 
                                        onClick={enviarRecursos}
                                        className="botaoGeral botaoGeral--largo botaoGeral--primario"
                                    >
                                        Despachar Mercadores
                                    </button>
                                </div>
                            )
                        })()}

                        {abaAtiva === 'admin' && (
                            <div style={{ marginTop: 'var(--espacamentoMedio)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ padding: '16px', border: '1px dashed var(--corPerigo)', borderRadius: '8px', background: 'rgba(255,0,0,0.05)' }}>
                                    <h3 style={{ color: 'var(--corPerigo)', marginBottom: '8px' }}>Zona de Perigo</h3>
                                    <button onClick={() => deletarAldeiaDeus(aldeiaSelecionada.id)} className="botaoGeral botaoGeral--perigo botaoGeral--largo">
                                        🗑️ Oblitera Aldeia (Deletar)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {modalCriacao && modalCriacao.show && (
                <div className="modalFundo animarSurgimento">
                    <div className="modalConteudo" style={{ maxWidth: '400px' }}>
                        <div className="modalCabecalho">
                            <h2 className="modalTitulo">Fundar Aldeia ({modalCriacao.x}|{modalCriacao.y})</h2>
                            <button onClick={() => definirModalCriacao(null)} className="botaoGeral botaoGeral--secundario" style={{ padding: '4px 8px' }}>✕</button>
                        </div>
                        <div className="modalCorpo" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Tipo de Aldeia</label>
                                <select className="campoTexto" value={modalCriacao.type} onChange={e => definirModalCriacao({...modalCriacao, type: e.target.value as 'barbarian'|'player'})}>
                                    <option value="barbarian">Bárbara (NPC)</option>
                                    <option value="player">Jogador (Atribuir)</option>
                                </select>
                            </div>

                            {modalCriacao.type === 'player' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Nome do Jogador Exato</label>
                                    <input type="text" className="campoTexto" value={modalCriacao.ownerUsername} onChange={e => definirModalCriacao({...modalCriacao, ownerUsername: e.target.value})} placeholder="Ex: ygarciapardinho" />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Porte da Aldeia (Recursos Iniciais)</label>
                                <select className="campoTexto" value={modalCriacao.pattern} onChange={e => definirModalCriacao({...modalCriacao, pattern: e.target.value as 'small'|'medium'|'large'})}>
                                    <option value="small">Pequena</option>
                                    <option value="medium">Média</option>
                                    <option value="large">Avançada</option>
                                </select>
                            </div>

                            <button onClick={fundarAldeiaDeus} className="botaoGeral botaoGeral--primario botaoGeral--largo" style={{ marginTop: '8px' }}>
                                ⚡ Invocar Aldeia
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
