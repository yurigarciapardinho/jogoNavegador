import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import { usarEstadoJogo } from '../../store/estadoJogo'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Users, Tent, ScrollText, Pickaxe } from 'lucide-react'

const GraficosKPI: React.FC = () => {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [dadosKpi, definirDadosKpi] = useState<any>(null)
    const [carregando, definirCarregando] = useState(true)

    useEffect(() => {
        const carregar = async () => {
            try {
                const dados = await api.get('/admin/kpis', token || '')
                definirDadosKpi(dados)
            } catch (erro: any) {
                adicionarNotificacao('Erro ao carregar KPIs: ' + erro.message, 'erro')
            } finally {
                definirCarregando(false)
            }
        }
        carregar()
    }, [token])

    if (carregando) return <div style={{ color: '#aaa', textAlign: 'center', padding: '50px' }}>Carregando métricas da nuvem...</div>
    if (!dadosKpi) return null

    const coresEconomia = ['#8B5A2B', '#A0522D', '#708090'] // Madeira, Argila, Ferro
    const dadosEconomia = [
        { name: 'Madeira', value: dadosKpi.totalEconomy.wood },
        { name: 'Argila', value: dadosKpi.totalEconomy.clay },
        { name: 'Ferro', value: dadosKpi.totalEconomy.iron }
    ]

    const dadosGerais = [
        { name: 'Usuários', count: dadosKpi.totalUsers },
        { name: 'Aldeias', count: dadosKpi.totalVillages },
        { name: 'Relatórios', count: dadosKpi.totalReports }
    ]

    const totalRecursos = dadosKpi.totalEconomy.wood + dadosKpi.totalEconomy.clay + dadosKpi.totalEconomy.iron

    const MetricCard = ({ title, value, icon: Icon, color }: any) => (
        <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s',
            cursor: 'default',
        }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
           onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{
                backgroundColor: `${color}20`,
                color: color,
                padding: '12px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 15px ${color}40`
            }}>
                <Icon size={24} />
            </div>
            <div>
                <div style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</div>
                <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{value.toLocaleString()}</div>
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <MetricCard title="Usuários Ativos" value={dadosKpi.totalUsers} icon={Users} color="#4CAF50" />
                <MetricCard title="Aldeias no Mapa" value={dadosKpi.totalVillages} icon={Tent} color="#2196F3" />
                <MetricCard title="Batalhas Registradas" value={dadosKpi.totalReports} icon={ScrollText} color="#FF9800" />
                <MetricCard title="Recursos Minerados" value={totalRecursos} icon={Pickaxe} color="#9C27B0" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '25px', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <h3 style={{ color: '#eee', marginTop: 0, marginBottom: '20px', fontWeight: 500 }}>Distribuição da Economia</h3>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dadosEconomia}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {dadosEconomia.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={coresEconomia[index % coresEconomia.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    formatter={(value: number) => value.toLocaleString()} 
                                    contentStyle={{ backgroundColor: 'rgba(20,20,20,0.9)', border: '1px solid #444', borderRadius: '8px' }}
                                    itemStyle={{ color: 'white' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '25px', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <h3 style={{ color: '#eee', marginTop: 0, marginBottom: '20px', fontWeight: 500 }}>Volume do Servidor</h3>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dadosGerais} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="#888" axisLine={false} tickLine={false} />
                                <YAxis stroke="#888" axisLine={false} tickLine={false} />
                                <RechartsTooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                    contentStyle={{ backgroundColor: 'rgba(20,20,20,0.9)', border: '1px solid #444', borderRadius: '8px', color: 'white' }} 
                                />
                                <Bar dataKey="count" fill="var(--corPrimaria)" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default GraficosKPI
