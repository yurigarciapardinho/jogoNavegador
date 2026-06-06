import React, { useState, useEffect } from 'react';
import ContadorTempo from './ContadorTempo';
import { obterPropriedadesUnidade } from '../constantes/constantesJogo';

export const UnidadeRecrutamentoCard = React.memo(({
    tipo,
    dadosAldeia,
    recursos,
    filaUnidadesAtiva,
    popAtual,
    maxPop,
    carregandoConstrucao,
    onRecrutar
}: any) => {
    const propriedades = obterPropriedadesUnidade(tipo);
    const quantidadeAtual = dadosAldeia?.units?.[tipo] || 0;
    const [quantidadeParaRecrutar, setQuantidadeParaRecrutar] = useState(0);

    const nivelQuartel = dadosAldeia?.buildings?.barracks || 0;
    const fatorTempo = Math.pow(0.95, Math.max(0, nivelQuartel - 1));

    // Cálculos O(1) de Teto Máximo
    const maxMadeira = Math.floor(recursos.madeira / propriedades.madeira);
    const maxArgila = Math.floor(recursos.argila / propriedades.argila);
    const maxFerro = Math.floor(recursos.ferro / propriedades.ferro);
    const maxPopLivre = Math.floor(Math.max(0, maxPop - popAtual) / (propriedades.populacao || 1));

    const quantidadeMaximaPermitida = Math.max(0, Math.min(maxMadeira, maxArgila, maxFerro, maxPopLivre));

    // Corrige quantidade se ultrapassar o limite (pode acontecer se gastar recurso em outro lugar)
    useEffect(() => {
        if (quantidadeParaRecrutar > quantidadeMaximaPermitida) {
            setQuantidadeParaRecrutar(quantidadeMaximaPermitida);
        }
    }, [quantidadeMaximaPermitida, quantidadeParaRecrutar]);

    const totalMadeira = propriedades.madeira * quantidadeParaRecrutar;
    const totalArgila = propriedades.argila * quantidadeParaRecrutar;
    const totalFerro = propriedades.ferro * quantidadeParaRecrutar;
    const totalTempo = Math.floor(propriedades.tempoSegundos * fatorTempo * quantidadeParaRecrutar);
    const totalPop = quantidadeParaRecrutar * (propriedades.populacao || 1);

    const estaValido = quantidadeParaRecrutar > 0 && !carregandoConstrucao && nivelQuartel > 0;
    const estaNafila = filaUnidadesAtiva.find((q: any) => q.unitType === tipo);

    return (
        <div className="cartaoItem animarSurgimento" key={tipo}>
            <div className="cartaoItem_cabecalho">
                <div>
                    <p style={{ fontWeight: 'bold' }}>{propriedades.nome}</p>
                    <p className="cartaoItem_detalhe">Em casa: {quantidadeAtual}</p>
                </div>
                {estaNafila && (
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--corPrimariaHover)', fontSize: '0.875rem', fontWeight: 'bold' }}>
                            <ContadorTempo endTime={estaNafila.endTime} />
                        </p>
                        <p className="cartaoItem_detalhe">Treinando: {estaNafila.amount}</p>
                    </div>
                )}
            </div>

            {!estaNafila && (
                <div style={{ marginTop: 'var(--espacamentoPequeno)' }}>
                    <div className="tropaCorpo" style={{ opacity: nivelQuartel === 0 ? 0.5 : 1 }}>
                        <input
                            type="range"
                            min="0"
                            max={quantidadeMaximaPermitida}
                            value={quantidadeParaRecrutar}
                            onChange={(e) => setQuantidadeParaRecrutar(parseInt(e.target.value) || 0)}
                            className="tropaSliderControle"
                            disabled={nivelQuartel === 0 || quantidadeMaximaPermitida === 0}
                            aria-label={`Quantidade de ${propriedades.nome} via controle deslizante`}
                        />
                        
                        <div className="tropaAcoes">
                            <button 
                                type="button"
                                className="tropaBotaoMax" 
                                onClick={() => setQuantidadeParaRecrutar(quantidadeMaximaPermitida)}
                                disabled={nivelQuartel === 0 || quantidadeMaximaPermitida === 0}
                            >
                                MAX
                            </button>
                            <input
                                type="number"
                                min="0"
                                max={quantidadeMaximaPermitida}
                                value={quantidadeParaRecrutar === 0 ? '' : quantidadeParaRecrutar}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    setQuantidadeParaRecrutar(isNaN(val) ? 0 : Math.min(quantidadeMaximaPermitida, Math.max(0, val)));
                                }}
                                className="tropaInputNumero"
                                disabled={nivelQuartel === 0}
                                placeholder="0"
                                aria-label={`Quantidade de ${propriedades.nome}`}
                            />
                        </div>
                    </div>

                    <div className="cartaoItem_acoes" style={{ marginTop: 'var(--espacamentoPequeno)' }}>
                        <div className="cartaoItem_detalhe" style={{ flex: 1 }}>
                            {quantidadeParaRecrutar > 0 && (
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span title="Madeira"><span aria-hidden="true" style={{ color: '#d97706' }}>🪵</span> {totalMadeira}</span>
                                    <span title="Argila"><span aria-hidden="true" style={{ color: '#ea580c' }}>🧱</span> {totalArgila}</span>
                                    <span title="Ferro"><span aria-hidden="true" style={{ color: '#94a3b8' }}>⚒️</span> {totalFerro}</span>
                                    <span title="População"><span aria-hidden="true">👨‍🌾</span> {totalPop}</span>
                                    <span title="Tempo"><span aria-hidden="true">⏱️</span> {totalTempo}s</span>
                                </div>
                            )}
                            {quantidadeParaRecrutar === 0 && quantidadeMaximaPermitida > 0 && nivelQuartel > 0 && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--corTextoSecundario)' }}>
                                    Máx. Recrutável: {quantidadeMaximaPermitida}
                                </span>
                            )}
                            {quantidadeMaximaPermitida === 0 && nivelQuartel > 0 && (
                                <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                                    Recursos ou População insuficientes
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                onRecrutar(tipo, quantidadeParaRecrutar);
                                setQuantidadeParaRecrutar(0); // reseta após recrutar
                            }}
                            disabled={!estaValido}
                            className={`botaoGeral ${estaValido ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                        >
                            {nivelQuartel === 0 ? <><span aria-hidden="true">🔒</span> Bloqueado</> : 'Treinar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
