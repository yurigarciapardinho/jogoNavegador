import { useEffect, useState } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'

import { api } from '../api'

export default function TelaAldeia() {
    const { recursos, definirRecursos, token, adicionarNotificacao } = usarEstadoJogo()
    const [dadosAldeia, definirDadosAldeia] = useState<any>(null)
    const [erroBusca, definirErroBusca] = useState('')
    const [carregandoConstrucao, definirCarregandoConstrucao] = useState(false)
    const [filaAtiva, definirFilaAtiva] = useState<any[]>([])
    const [filaUnidadesAtiva, definirFilaUnidadesAtiva] = useState<any[]>([])
    const [quantidadesRecrutamento, definirQuantidadesRecrutamento] = useState<Record<string, number>>({ spear: 0, sword: 0, axe: 0 })
    const [agora, definirAgora] = useState(new Date())

    useEffect(() => {
        const intervalo = setInterval(() => definirAgora(new Date()), 1000)
        return () => clearInterval(intervalo)
    }, [])

    const buscarAldeia = async () => {
        try {
            const dadosMeResponse = await api.get('/me/villages', token)
            
            // O backend agora retorna { villages, globalMessage, role }
            const { villages, globalMessage } = dadosMeResponse
            
            usarEstadoJogo.getState().definirMensagemGlobal(globalMessage || null)
            
            if (villages && villages.length > 0) {
                const idAldeia = villages[0].id
                const dados = await api.get(`/village/${idAldeia}`, token)
                
                definirDadosAldeia(dados)
                definirRecursos({
                    madeira: dados.resources.wood || 0,
                    argila: dados.resources.clay || 0,
                    ferro: dados.resources.iron || 0
                })
                definirFilaAtiva(dados.activeQueue || [])
                definirFilaUnidadesAtiva(dados.activeUnitQueue || [])
            } else {
                definirErroBusca('Nenhuma aldeia encontrada para esta conta.')
            }
        } catch (erro: any) {
            definirErroBusca(erro.message || 'Erro ao conectar com o backend.')
        }
    }

    useEffect(() => {
        buscarAldeia()
    }, [])

    const evoluirConstrucao = async (tipoEdificio: string) => {
        if (!dadosAldeia) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/build', { villageId: dadosAldeia.id, buildingType: tipoEdificio }, token)
            adicionarNotificacao('Construção iniciada com sucesso!', 'sucesso')
            await buscarAldeia()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de construção.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }

    const obterCusto = (tipoEdificio: string, nivel: number) => {
        const bases: any = {
            timberCamp: { wood: 50, clay: 60, iron: 40, timeSec: 15 },
            clayPit:    { wood: 65, clay: 50, iron: 40, timeSec: 15 },
            ironMine:   { wood: 75, clay: 65, iron: 70, timeSec: 18 }
        }
        const base = bases[tipoEdificio] || { wood: 50, clay: 50, iron: 50, timeSec: 10 }
        const fator = Math.pow(1.2, nivel - 1)
        return {
            madeira: Math.floor(base.wood * fator),
            argila: Math.floor(base.clay * fator),
            ferro: Math.floor(base.iron * fator),
            tempoSegundos: Math.floor(base.timeSec * fator)
        }
    }

    const obterPropriedadesUnidade = (tipo: string) => {
        const propriedades: any = {
            spear: { nome: 'Lanceiro', madeira: 50, argila: 30, ferro: 10, tempoSegundos: 15 },
            sword: { nome: 'Espadachim', madeira: 30, argila: 30, ferro: 70, tempoSegundos: 25 },
            axe:   { nome: 'Bárbaro (Machado)', madeira: 60, argila: 30, ferro: 40, tempoSegundos: 20 }
        }
        return propriedades[tipo]
    }

    const recrutarTropa = async (tipoUnidade: string) => {
        const quantidade = quantidadesRecrutamento[tipoUnidade]
        if (!quantidade || quantidade <= 0 || !dadosAldeia) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/recruit', { villageId: dadosAldeia.id, unitType: tipoUnidade, amount: quantidade }, token)
            adicionarNotificacao(`Treinamento de ${quantidade} tropas iniciado!`, 'sucesso')
            definirQuantidadesRecrutamento({ ...quantidadesRecrutamento, [tipoUnidade]: 0 })
            await buscarAldeia()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de recrutamento.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }

    const renderizarLinhaUnidade = (tipo: string) => {
        const propriedades = obterPropriedadesUnidade(tipo)
        const quantidadeAtual = dadosAldeia?.units?.[tipo] || 0
        const quantidadeParaRecrutar = quantidadesRecrutamento[tipo] || 0
        
        const nivelQuartel = dadosAldeia?.buildings?.barracks || 0
        const fatorTempo = Math.pow(0.95, Math.max(0, nivelQuartel - 1))
        
        const totalMadeira = propriedades.madeira * quantidadeParaRecrutar
        const totalArgila = propriedades.argila * quantidadeParaRecrutar
        const totalFerro = propriedades.ferro * quantidadeParaRecrutar
        const totalTempo = Math.floor(propriedades.tempoSegundos * fatorTempo * quantidadeParaRecrutar)
        
        const podePagar = recursos.madeira >= totalMadeira && recursos.argila >= totalArgila && recursos.ferro >= totalFerro
        const estaValido = quantidadeParaRecrutar > 0 && podePagar && !carregandoConstrucao
        
        const estaNafila = filaUnidadesAtiva.find(q => q.unitType === tipo)
        let textoRestante = ''
        if (estaNafila) {
            const restante = Math.max(0, new Date(estaNafila.endTime).getTime() - agora.getTime())
            if (restante === 0) textoRestante = 'Pronto! (Atualize a página)'
            else textoRestante = `Faltam ${Math.ceil(restante / 1000)}s`
        }

        return (
            <div className="cartaoItem animarSurgimento" key={tipo}>
                <div className="cartaoItem_cabecalho">
                    <div>
                        <p style={{ fontWeight: 'bold' }}>{propriedades.nome}</p>
                        <p className="cartaoItem_detalhe">Em casa: {quantidadeAtual}</p>
                    </div>
                    {estaNafila && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--corPrimariaHover)', fontSize: '0.875rem', fontWeight: 'bold' }}>{textoRestante}</p>
                            <p className="cartaoItem_detalhe">Treinando: {estaNafila.amount}</p>
                        </div>
                    )}
                </div>
                
                {!estaNafila && (
                    <div className="cartaoItem_acoes">
                        <input 
                            type="number" 
                            min="0" 
                            value={quantidadeParaRecrutar || ''} 
                            onChange={(e) => definirQuantidadesRecrutamento({ ...quantidadesRecrutamento, [tipo]: parseInt(e.target.value) || 0 })}
                            className="campoEntrada"
                            style={{ width: '80px' }}
                            placeholder="0"
                        />
                        <div className="cartaoItem_detalhe" style={{ flex: 1, marginLeft: 'var(--espacamentoPequeno)' }}>
                            {quantidadeParaRecrutar > 0 && (
                                <>
                                    Custo: {totalMadeira} <span style={{ color: '#d97706' }}>Mad</span> | {totalArgila} <span style={{ color: '#ea580c' }}>Arg</span> | {totalFerro} <span style={{ color: '#94a3b8' }}>Fer</span>
                                    <br/>
                                    Tempo: {totalTempo}s
                                </>
                            )}
                        </div>
                        <button 
                            onClick={() => recrutarTropa(tipo)}
                            disabled={!estaValido}
                            className={`botaoGeral ${estaValido ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                        >
                            Recrutar
                        </button>
                    </div>
                )}
            </div>
        )
    }

    const renderizarLinhaEdificio = (tipo: string, nome: string, nivel: number, corDestaque: string) => {
        const estaNafila = filaAtiva.find(q => q.buildingType === tipo)
        const proximoNivel = estaNafila ? estaNafila.targetLevel : nivel + 1
        const custo = obterCusto(tipo, proximoNivel)
        
        let textoRestante = ''
        let desativado = carregandoConstrucao
        
        if (estaNafila) {
            desativado = true
            const restante = Math.max(0, new Date(estaNafila.endTime).getTime() - agora.getTime())
            if (restante === 0) {
                textoRestante = 'Pronto! (Atualize a página)'
            } else {
                textoRestante = `Faltam ${Math.ceil(restante / 1000)}s`
            }
        } else if (recursos.madeira < custo.madeira || recursos.argila < custo.argila || recursos.ferro < custo.ferro) {
            desativado = true
        }

        return (
            <div className="cartaoItem animarSurgimento">
                <div className="cartaoItem_cabecalho" style={{ marginBottom: 0 }}>
                    <div>
                        <p style={{ fontWeight: 'bold', color: corDestaque }}>{nome}</p>
                        <p className="cartaoItem_detalhe">Nível {nivel}</p>
                        {!estaNafila && (
                            <p className="cartaoItem_detalhe" style={{ marginTop: '4px' }}>
                                Custo: {custo.madeira} <span style={{ color: '#d97706' }}>Mad</span> | {custo.argila} <span style={{ color: '#ea580c' }}>Arg</span> | {custo.ferro} <span style={{ color: '#94a3b8' }}>Fer</span>
                            </p>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {estaNafila && <p style={{ color: 'var(--corPrimariaHover)', fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '4px' }}>{textoRestante}</p>}
                        <button 
                            onClick={() => evoluirConstrucao(tipo)}
                            disabled={desativado}
                            className={`botaoGeral ${!desativado && !estaNafila ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                        >
                            {estaNafila ? 'Em fila...' : `Evoluir (${custo.tempoSegundos}s)`}
                        </button>
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

            <header className="painelRecursos">
                <div className="recursoItem" style={{ color: '#d97706' }}>Madeira: {Math.floor(recursos.madeira)}</div>
                <div className="recursoItem" style={{ color: '#ea580c' }}>Argila: {Math.floor(recursos.argila)}</div>
                <div className="recursoItem" style={{ color: '#94a3b8' }}>Ferro: {Math.floor(recursos.ferro)}</div>
            </header>

            <main className="gradePaineis">
                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Edifícios (Sede)</h2>
                    
                    {dadosAldeia?.buildings ? (
                        <div>
                            {renderizarLinhaEdificio('timberCamp', 'Bosque (Madeira)', dadosAldeia.buildings.timberCamp, '#d97706')}
                            {renderizarLinhaEdificio('clayPit', 'Poço de Argila', dadosAldeia.buildings.clayPit, '#ea580c')}
                            {renderizarLinhaEdificio('ironMine', 'Mina de Ferro', dadosAldeia.buildings.ironMine, '#94a3b8')}
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando edifícios...</p>
                    )}
                </section>

                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Quartel (Tropas)</h2>
                    
                    {dadosAldeia?.units ? (
                        <div>
                            {renderizarLinhaUnidade('spear')}
                            {renderizarLinhaUnidade('sword')}
                            {renderizarLinhaUnidade('axe')}

                            <div style={{ marginTop: 'var(--espacamentoMedio)', padding: 'var(--espacamentoMedio)', backgroundColor: 'var(--corFundoEscuro)', borderRadius: 'var(--bordaArredondada)', fontSize: '0.875rem', color: 'var(--corTextoSecundario)' }}>
                                Para atacar, vá no Mapa, clique na aldeia inimiga e copie o ID dela. (MVP Command)
                            </div>
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando tropas...</p>
                    )}
                </section>
            </main>
        </section>
    )
}