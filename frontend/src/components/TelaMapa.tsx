import React, { useEffect, useRef, useState } from 'react'
import { MotorMapa } from '../game/MotorMapa'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function TelaMapa() {
    const refContainer = useRef<HTMLDivElement>(null)
    const refMotor = useRef<MotorMapa | null>(null)
    const { token, usuario, adicionarNotificacao } = usarEstadoJogo()
    
    const [aldeiaSelecionada, definirAldeiaSelecionada] = useState<any | null>(null)
    const [abaAtiva, definirAbaAtiva] = useState<'info' | 'atacar' | 'apoiar'>('info')
    
    const [qtdLanceiro, definirQtdLanceiro] = useState(0)
    const [qtdEspadachim, definirQtdEspadachim] = useState(0)
    const [qtdBarbaro, definirQtdBarbaro] = useState(0)

    const [unidadesOrigem, definirUnidadesOrigem] = useState({ lanceiro: 0, espadachim: 0, barbaro: 0 })
    const [idAldeiaOrigem, definirIdAldeiaOrigem] = useState<string | null>(null)
    
    // Buscar tropas ativas do jogador para validar limite
    useEffect(() => {
        let estaMontado = true
        if (token && usuario) {
            fetch('http://localhost:8080/me/villages', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(resposta => resposta.json())
            .then(dados => {
                if (estaMontado && dados.length > 0) {
                    definirIdAldeiaOrigem(dados[0].id)
                    if (dados[0].units) {
                        definirUnidadesOrigem({
                            lanceiro: dados[0].units.spear || 0,
                            espadachim: dados[0].units.sword || 0,
                            barbaro: dados[0].units.axe || 0
                        })
                    }
                }
            })
            .catch(() => adicionarNotificacao('Erro ao carregar dados da sua aldeia no mapa.', 'erro'))
        }
        return () => { estaMontado = false }
    }, [token, usuario])

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
                refMotor.current = null;
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
                refMotor.current = null;
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
            const resposta = await fetch('http://localhost:8080/village/attack', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    originId: idAldeiaOrigem,
                    targetId: aldeiaSelecionada.id,
                    spear: qtdLanceiro,
                    sword: qtdEspadachim,
                    axe: qtdBarbaro
                })
            })

            const dados = await resposta.json()
            if (resposta.ok) {
                adicionarNotificacao(`${tipo === 'ATTACK' ? 'Ataque' : 'Apoio'} enviado com sucesso!`, 'sucesso')
                definirAldeiaSelecionada(null)
                definirQtdLanceiro(0)
                definirQtdEspadachim(0)
                definirQtdBarbaro(0)
            } else {
                adicionarNotificacao(`Erro: ${dados.error}`, 'erro')
            }
        } catch (erro) {
            adicionarNotificacao('Erro ao enviar movimento de tropas.', 'erro')
        }
    }

    return (
        <section className="telaMapa">
            <div ref={refContainer} className="telaMapa_containerPixi" onContextMenu={(e) => e.preventDefault()} />
            
            <div className="telaMapa_dicaFlutuante">
                <p>Pressione e arraste para mover o mapa. Clique em uma aldeia para interagir.</p>
            </div>

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
                            {aldeiaSelecionada.userId !== usuario?.id && (
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
                                <p className="campoRotulo">Coordenadas: <span style={{ color: 'var(--corTextoPrincipal)' }}>{aldeiaSelecionada.x} | {aldeiaSelecionada.y}</span></p>
                                <p className="campoRotulo">Jogador: <span style={{ color: 'var(--corTextoPrincipal)' }}>{aldeiaSelecionada.userId ? 'Sim' : 'Aldeia Bárbara (NPC)'}</span></p>
                                {aldeiaSelecionada.userId === null && (
                                    <p className="textoDestaque" style={{ cursor: 'default' }}>Dica: Aldeias Bárbaras são alvos fáceis para farmar recursos no início do jogo!</p>
                                )}
                            </div>
                        )}

                        {(abaAtiva === 'atacar' || abaAtiva === 'apoiar') && (
                            <div style={{ marginTop: 'var(--espacamentoMedio)' }}>
                                <p className="campoRotulo" style={{ marginBottom: 'var(--espacamentoMedio)' }}>Selecione as tropas que deseja enviar a partir da sua aldeia.</p>
                                
                                <div className="gradeTropas">
                                    <div className="areaTropa">
                                        <div className="campoRotulo">Lanceiro</div>
                                        <input type="number" min="0" max={unidadesOrigem.lanceiro} value={qtdLanceiro} onChange={e => definirQtdLanceiro(Number(e.target.value))} className="campoEntrada" />
                                        <div className="textoDestaque" onClick={() => definirQtdLanceiro(unidadesOrigem.lanceiro)}>(Máx: {unidadesOrigem.lanceiro})</div>
                                    </div>
                                    <div className="areaTropa">
                                        <div className="campoRotulo">Espadachim</div>
                                        <input type="number" min="0" max={unidadesOrigem.espadachim} value={qtdEspadachim} onChange={e => definirQtdEspadachim(Number(e.target.value))} className="campoEntrada" />
                                        <div className="textoDestaque" onClick={() => definirQtdEspadachim(unidadesOrigem.espadachim)}>(Máx: {unidadesOrigem.espadachim})</div>
                                    </div>
                                    <div className="areaTropa">
                                        <div className="campoRotulo">Bárbaro</div>
                                        <input type="number" min="0" max={unidadesOrigem.barbaro} value={qtdBarbaro} onChange={e => definirQtdBarbaro(Number(e.target.value))} className="campoEntrada" />
                                        <div className="textoDestaque" onClick={() => definirQtdBarbaro(unidadesOrigem.barbaro)}>(Máx: {unidadesOrigem.barbaro})</div>
                                    </div>
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
