import { useEffect, useState, useMemo } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import ContadorTempo from './ContadorTempo'
import PainelMovimentos from './PainelMovimentos'
import { PainelMissoes } from './PainelMissoes'
import { obterCustoEdificio, obterPropriedadesUnidade, obterProducaoRecurso, obterCapacidadeArmazem, obterCapacidadeFazenda, PROPRIEDADES_UNIDADES, MAX_LEVELS, getBuildingPopCost } from '../constantes/constantesJogo'
import { api } from '../api'
import { UnidadeRecrutamentoCard } from './UnidadeRecrutamentoCard'

export default function TelaAldeia() {
    const { recursos, token, adicionarNotificacao, dadosAldeia, filaAtiva, filaUnidadesAtiva, activeMultipliers, sincronizarAldeiaSilenciosa } = usarEstadoJogo()
    const [erroBusca, definirErroBusca] = useState('')
    const [carregandoConstrucao, definirCarregandoConstrucao] = useState(false)


    const popAtual = useMemo(() => {
        if (!dadosAldeia) return 0;
        let pop = 0;
        const addUnidades = (spear = 0, sword = 0, axe = 0) => {
            pop += (spear * (PROPRIEDADES_UNIDADES.spear?.populacao || 1));
            pop += (sword * (PROPRIEDADES_UNIDADES.sword?.populacao || 1));
            pop += (axe * (PROPRIEDADES_UNIDADES.axe?.populacao || 1));
        };

        const BUILDINGS_VALIDOS = ['headquarters', 'timberCamp', 'clayPit', 'ironMine', 'farm', 'warehouse', 'barracks', 'market', 'wall', 'church']
        if (dadosAldeia.buildings) {
            BUILDINGS_VALIDOS.forEach(bType => {
                pop += getBuildingPopCost(bType, dadosAldeia.buildings[bType] || 0)
            })
        }
        
        const nextLevels: Record<string, number> = {}
        if (dadosAldeia.buildings) {
            BUILDINGS_VALIDOS.forEach(bType => nextLevels[bType] = dadosAldeia.buildings[bType] || 0)
        }
        
        filaAtiva.forEach(q => {
            const prevLvl = nextLevels[q.buildingType] || 0
            const targetLvl = q.targetLevel
            pop += getBuildingPopCost(q.buildingType, targetLvl) - getBuildingPopCost(q.buildingType, prevLvl)
            nextLevels[q.buildingType] = targetLvl
        })

        if (dadosAldeia.units) {
            addUnidades(dadosAldeia.units.spear, dadosAldeia.units.sword, dadosAldeia.units.axe);
        }
        
        filaUnidadesAtiva.forEach(q => {
            const props = PROPRIEDADES_UNIDADES[q.unitType];
            if (props) {
                pop += q.amount * (props.populacao || 1);
            }
        });
        
        dadosAldeia.movementsOrigin?.forEach((m: any) => {
            if (m.type !== 'TRANSFER') {
                addUnidades(m.spear, m.sword, m.axe);
            }
        });
        dadosAldeia.movementsTarget?.forEach((m: any) => {
            if (m.type === 'TRANSFER') {
                addUnidades(m.spear, m.sword, m.axe);
            }
        });
        dadosAldeia.supportingSent?.forEach((s: any) => addUnidades(s.spear, s.sword, s.axe));

        return pop;
    }, [dadosAldeia, filaAtiva, filaUnidadesAtiva]);

    const maxPop = obterCapacidadeFazenda(dadosAldeia?.buildings?.farm || 1);

    const buscarAldeia = async () => {
        try {
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            definirErroBusca('Erro ao conectar com o backend.')
        }
    }

    useEffect(() => {
        if (!dadosAldeia) {
            buscarAldeia()
        }
    }, [])

    const evoluirConstrucao = async (tipoEdificio: string) => {
        if (!dadosAldeia || carregandoConstrucao) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/build', { villageId: dadosAldeia.id, buildingType: tipoEdificio }, token)
            adicionarNotificacao('Construção iniciada com sucesso!', 'sucesso')
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de construção.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }



    const recrutarTropa = async (tipoUnidade: string, quantidade: number) => {
        if (!quantidade || quantidade <= 0 || !dadosAldeia) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/recruit', { villageId: dadosAldeia.id, unitType: tipoUnidade, amount: quantidade }, token)
            adicionarNotificacao(`Treinamento de ${quantidade} tropas iniciado!`, 'sucesso')
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de recrutamento.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }

    const renderizarLinhaUnidade = (tipo: string) => {
        return (
            <UnidadeRecrutamentoCard
                key={tipo}
                tipo={tipo}
                dadosAldeia={dadosAldeia}
                recursos={recursos}
                filaUnidadesAtiva={filaUnidadesAtiva}
                popAtual={popAtual}
                maxPop={maxPop}
                carregandoConstrucao={carregandoConstrucao}
                onRecrutar={recrutarTropa}
            />
        )
    }
    const getRequisitosEdificio = (tipo: string) => {
        switch (tipo) {
            case 'headquarters': return {}; // Sede nunca tem requisito
            case 'barracks': return { headquarters: 3 };
            case 'market': return { headquarters: 3, warehouse: 2 };
            case 'wall': return { barracks: 1 };
            case 'church': return { headquarters: 5 };
            default: return { headquarters: 1 }; // Bosques, minas, fazenda, armazém exigem Sede 1
        }
    }

    const renderizarLinhaEdificio = (tipo: string, nome: string, nivel: number, corDestaque: string) => {
        const requisitos = getRequisitosEdificio(tipo);
        const hqAtual = dadosAldeia?.buildings?.headquarters || 0;
        const armazemAtual = dadosAldeia?.buildings?.warehouse || 0;
        const quartelAtual = dadosAldeia?.buildings?.barracks || 0;

        let reqCumpridos = true;
        let msgErro = '';

        if (requisitos.headquarters && hqAtual < requisitos.headquarters) {
            reqCumpridos = false;
            msgErro = `Requer Sede Nível ${requisitos.headquarters}`;
        } else if (requisitos.warehouse && armazemAtual < requisitos.warehouse) {
            reqCumpridos = false;
            msgErro = `Requer Armazém Nível ${requisitos.warehouse}`;
        } else if (requisitos.barracks && quartelAtual < requisitos.barracks) {
            reqCumpridos = false;
            msgErro = `Requer Quartel Nível ${requisitos.barracks}`;
        }

        if (!reqCumpridos) {
            return (
                <div key={tipo} className="cartaoItem animarSurgimento" style={{ opacity: 0.5, filter: 'grayscale(100%)' }}>
                    <div className="cartaoItem_cabecalho" style={{ marginBottom: 0 }}>
                        <p style={{ fontWeight: 'bold', color: 'var(--corTextoSecundario)' }}>
                            <span aria-hidden="true">🔒</span> {nome} (Bloqueado)
                        </p>
                        <p className="cartaoItem_detalhe" style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            {msgErro}
                        </p>
                    </div>
                </div>
            )
        }

        const filaAtivaItens = filaAtiva.filter(q => q.buildingType === tipo)
        const estaNafila = filaAtivaItens.length > 0
        const itemNaFila = estaNafila ? filaAtivaItens[0] : null
        
        // Pega o índice real desse edifício na fila global para saber se é o primeiro a ser construído
        const indexGlobalNaFila = itemNaFila ? filaAtiva.findIndex(q => q.id === itemNaFila.id) : -1

        const proximoNivel = estaNafila ? itemNaFila.targetLevel : nivel + 1
        const custo = obterCustoEdificio(tipo, proximoNivel)
        
        const maxLevel = MAX_LEVELS[tipo] || 25
        const atingiuMaximo = nivel >= maxLevel
        
        const popCusto = getBuildingPopCost(tipo, proximoNivel) - getBuildingPopCost(tipo, proximoNivel - 1)
        
        let desativado = carregandoConstrucao
        
        if (estaNafila || atingiuMaximo) {
            desativado = true
        } else if (recursos.madeira < custo.madeira || recursos.argila < custo.argila || recursos.ferro < custo.ferro) {
            desativado = true
        } else if (popCusto > 0) {
            const popAtualGlobal = popAtual;
            if (popAtualGlobal + popCusto > maxPop) {
                desativado = true
            }
        }

        let detalheRendimento = null
        if (tipo === 'timberCamp' || tipo === 'clayPit' || tipo === 'ironMine') {
            let resourceKey: 'wood' | 'clay' | 'iron' = 'wood';
            if (tipo === 'clayPit') resourceKey = 'clay';
            if (tipo === 'ironMine') resourceKey = 'iron';

            const buildingMult = activeMultipliers[resourceKey] || 1.0;
            const isEventActive = buildingMult > 1.0;
            
            const prodAtual = obterProducaoRecurso(nivel, buildingMult)
            const prodProx = obterProducaoRecurso(proximoNivel, buildingMult)
            const uiColor = isEventActive ? '#eab308' : corDestaque;

            detalheRendimento = (
                <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                    Rendimento: <span style={{ color: uiColor, fontWeight: isEventActive ? 'bold' : 'normal' }}>{prodAtual}/h</span> 
                    {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)' }}>{prodProx}/h</span></span>}
                </p>
            )
        } else if (tipo === 'warehouse') {
            const capAtual = obterCapacidadeArmazem(nivel)
            const capProx = obterCapacidadeArmazem(proximoNivel)
            detalheRendimento = (
                <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                    Capacidade: <span style={{ color: corDestaque, fontWeight: 'bold' }}>{capAtual}</span> 
                    {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>{capProx}</span></span>}
                </p>
            )
        } else if (tipo === 'farm') {
            const popAtual = obterCapacidadeFazenda(nivel)
            const popProx = obterCapacidadeFazenda(proximoNivel)
            detalheRendimento = (
                <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                    População Máx: <span style={{ color: corDestaque, fontWeight: 'bold' }}>{popAtual}</span> 
                    {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>{popProx}</span></span>}
                </p>
            )
        } else if (tipo === 'barracks') {
            if (nivel === 0) {
                detalheRendimento = (
                    <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}><span aria-hidden="true">🔒</span> Não construído</span>
                        {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>100% (Vel. Base)</span></span>}
                    </p>
                )
            } else {
                const fatAtual = Math.round(Math.pow(0.95, Math.max(0, nivel - 1)) * 100)
                const fatProx = Math.round(Math.pow(0.95, Math.max(0, proximoNivel - 1)) * 100)
                detalheRendimento = (
                    <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                        Tempo de Treino: <span style={{ color: corDestaque, fontWeight: 'bold' }}>{fatAtual}%</span> 
                        {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>{fatProx}%</span></span>}
                    </p>
                )
            }
        } else if (tipo === 'wall') {
            const defPercAtual = nivel * 5
            const defBaseAtual = nivel * 50
            const defPercProx = proximoNivel * 5
            const defBaseProx = proximoNivel * 50
            detalheRendimento = (
                <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                    Bônus Defesa: <span style={{ color: corDestaque, fontWeight: 'bold' }}>+{defPercAtual}%</span> (+{defBaseAtual} fixo)
                    {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>+{defPercProx}%</span> (+{defBaseProx} fixo)</span>}
                </p>
            )
        } else if (tipo === 'market') {
            const mercadoresAtual = Math.floor(Math.pow(1.15, Math.max(0, nivel - 1)) * nivel)
            const mercadoresProx = Math.floor(Math.pow(1.15, Math.max(0, proximoNivel - 1)) * proximoNivel)
            detalheRendimento = (
                <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                    Mercadores: <span style={{ color: corDestaque, fontWeight: 'bold' }}>{mercadoresAtual}</span> (Capacidade: {mercadoresAtual * 1000})
                    {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)', fontWeight: 'bold' }}>{mercadoresProx}</span></span>}
                </p>
            )
        }

        return (
            <div key={tipo} className="cartaoItem animarSurgimento">
                <div className="cartaoItem_cabecalho" style={{ marginBottom: 0 }}>
                    <div>
                        <p style={{ fontWeight: 'bold', color: corDestaque, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {nome} <span style={{ fontSize: '0.8rem', color: 'var(--corTextoSecundario)' }}>Nível {nivel}</span>
                        </p>
                        
                        {detalheRendimento}

                        {!estaNafila && !atingiuMaximo && (
                            <div className="cartaoItem_detalhe" style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span title="Madeira"><span aria-hidden="true" style={{ color: '#d97706' }}>🪵</span> {custo.madeira}</span>
                                <span title="Argila"><span aria-hidden="true" style={{ color: '#ea580c' }}>🧱</span> {custo.argila}</span>
                                <span title="Ferro"><span aria-hidden="true" style={{ color: '#94a3b8' }}>⚒️</span> {custo.ferro}</span>
                                {popCusto > 0 && <span title="População"><span aria-hidden="true">👨‍🌾</span> {popCusto}</span>}
                            </div>
                        )}
                        {(recursos.madeira < custo.madeira || recursos.argila < custo.argila || recursos.ferro < custo.ferro) && !estaNafila && !atingiuMaximo ? (
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Recursos insuficientes</span>
                        ) : popCusto > 0 && (popAtual + popCusto > maxPop) && !estaNafila && !atingiuMaximo ? (
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Fazenda cheia</span>
                        ) : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {atingiuMaximo ? (
                            <div style={{ padding: '8px 16px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                                Nível Máximo
                            </div>
                        ) : (
                            <button 
                                onClick={() => evoluirConstrucao(tipo)}
                                disabled={desativado}
                                className={`botaoGeral ${!desativado && !estaNafila ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                            >
                                {estaNafila ? (indexGlobalNaFila === 0 ? 'Construindo...' : 'Na Fila') : `Evoluir (${custo.tempoSegundos}s)`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <section className="telaGeral">
            {erroBusca && (
                <div className="alertaErro">
                    ⚠️ {erroBusca}
                </div>
            )}

            {dadosAldeia && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espacamentoMedio)' }}>
                    <div className="telaGeral_titulo" style={{ color: 'var(--corPrimariaHover)', margin: 0 }}>
                        {dadosAldeia.name} (X:{dadosAldeia.x} Y:{dadosAldeia.y})
                    </div>
                    <button onClick={buscarAldeia} className="botaoGeral botaoGeral--secundario">
                        ↻ Recalcular & Sincronizar
                    </button>
                </div>
            )}

            {(() => {
                const capacidadeArmazem = dadosAldeia?.buildings ? obterCapacidadeArmazem(dadosAldeia.buildings.warehouse || 1) : 1500
                const madeiraLotada = recursos.madeira >= capacidadeArmazem
                const argilaLotada = recursos.argila >= capacidadeArmazem
                const ferroLotado = recursos.ferro >= capacidadeArmazem
                
                const popLotada = popAtual >= maxPop

                return (
                    <header className="painelRecursos">
                        <div className="recursoItem" style={{ color: madeiraLotada ? '#ef4444' : '#d97706', fontWeight: madeiraLotada ? 'bold' : 'normal' }}>
                            Madeira: {Math.floor(recursos.madeira)} / {capacidadeArmazem} {madeiraLotada && '⚠️'}
                        </div>
                        <div className="recursoItem" style={{ color: argilaLotada ? '#ef4444' : '#ea580c', fontWeight: argilaLotada ? 'bold' : 'normal' }}>
                            Argila: {Math.floor(recursos.argila)} / {capacidadeArmazem} {argilaLotada && '⚠️'}
                        </div>
                        <div className="recursoItem" style={{ color: ferroLotado ? '#ef4444' : '#94a3b8', fontWeight: ferroLotado ? 'bold' : 'normal' }}>
                            Ferro: {Math.floor(recursos.ferro)} / {capacidadeArmazem} {ferroLotado && '⚠️'}
                        </div>
                        <div className="recursoItem" style={{ color: popLotada ? '#ef4444' : '#10b981', fontWeight: popLotada ? 'bold' : 'normal' }}>
                            Pop: {popAtual} / {maxPop} {popLotada && '⚠️'}
                        </div>
                    </header>
                )
            })()}

            <main className="gradePaineis">
                <PainelMissoes aoAtualizar={buscarAldeia} />
                <PainelMovimentos dadosAldeia={dadosAldeia} aoAtualizar={buscarAldeia} />

                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Edifícios (Sede)</h2>
                    
                    {filaAtiva.length > 0 && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '4px solid var(--corPrimaria)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--corPrimariaHover)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span aria-hidden="true">🛠️</span> Fila de Construções
                            </h3>
                            {filaAtiva.map((item, i) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < filaAtiva.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '0.9rem', color: i === 0 ? '#fff' : 'var(--corTextoSecundario)' }}>
                                        <span style={{ display: 'inline-block', width: '20px', textAlign: 'center', background: i === 0 ? 'var(--corPrimaria)' : 'transparent', color: i === 0 ? '#000' : 'inherit', borderRadius: '4px', marginRight: '8px' }}>{i + 1}</span>
                                        {item.buildingType === 'timberCamp' ? 'Bosque' : item.buildingType === 'clayPit' ? 'Poço de Argila' : item.buildingType === 'ironMine' ? 'Mina de Ferro' : item.buildingType === 'warehouse' ? 'Armazém' : item.buildingType === 'farm' ? 'Fazenda' : item.buildingType === 'barracks' ? 'Quartel' : item.buildingType === 'market' ? 'Mercado' : item.buildingType === 'wall' ? 'Muralha' : item.buildingType === 'church' ? 'Igreja' : 'Edifício'} Nível {item.targetLevel}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: i === 0 ? 'var(--corSucesso)' : 'var(--corTextoSecundario)' }}>
                                        {i === 0 ? <ContadorTempo endTime={item.endTime} /> : 'Aguardando...'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {dadosAldeia?.buildings ? (
                        <div>
                            {renderizarLinhaEdificio('headquarters', 'Sede', dadosAldeia.buildings.headquarters || 1, '#3b82f6')}
                            {renderizarLinhaEdificio('timberCamp', 'Bosque (Madeira)', dadosAldeia.buildings.timberCamp, '#d97706')}
                            {renderizarLinhaEdificio('clayPit', 'Poço de Argila', dadosAldeia.buildings.clayPit, '#ea580c')}
                            {renderizarLinhaEdificio('ironMine', 'Mina de Ferro', dadosAldeia.buildings.ironMine, '#94a3b8')}
                            {renderizarLinhaEdificio('warehouse', 'Armazém', dadosAldeia.buildings.warehouse, '#a855f7')}
                            {renderizarLinhaEdificio('farm', 'Fazenda', dadosAldeia.buildings.farm, '#10b981')}
                            {renderizarLinhaEdificio('barracks', 'Quartel', dadosAldeia.buildings.barracks, '#ef4444')}
                            {renderizarLinhaEdificio('market', 'Mercado', dadosAldeia.buildings.market || 0, '#0284c7')}
                            {renderizarLinhaEdificio('wall', 'Muralha', dadosAldeia.buildings.wall || 0, '#64748b')}
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando edifícios...</p>
                    )}
                </section>

                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Quartel (Tropas)</h2>
                    
                    {dadosAldeia?.units ? (
                        <div style={{ opacity: (dadosAldeia.buildings?.barracks || 0) === 0 ? 0.5 : 1, position: 'relative' }}>
                            {(dadosAldeia.buildings?.barracks || 0) === 0 && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(0,0,0,0.6)', borderRadius: '8px'
                                }}>
                                    <div style={{ background: 'rgba(234, 179, 8, 0.9)', color: '#000', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                        <span aria-hidden="true">🔒</span> Quartel não construído. Evolua na Sede para o Nível 1.
                                    </div>
                                </div>
                            )}
                            {renderizarLinhaUnidade('spear')}
                            {renderizarLinhaUnidade('sword')}
                            {renderizarLinhaUnidade('axe')}
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando tropas...</p>
                    )}
                </section>
            </main>
        </section>
    )
}