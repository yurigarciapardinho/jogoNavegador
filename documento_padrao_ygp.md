# Documento Oficial de Padrões e Boas Práticas

## Padrão Yuri Garcia Pardinho — YGP

Este documento apresenta o guia oficial para desenvolvimento de front-end seguindo o **Padrão Yuri Garcia Pardinho (YGP)**.

A norma YGP tem como base o princípio **KISS — Keep It Simple, Stupid**, ou seja: manter o código simples, direto, organizado e fácil de entender.

A prioridade máxima do código deve ser:

- clareza;
- organização;
- padronização;
- simplicidade;
- facilidade de manutenção;
- ausência de complexidade desnecessária.

---

## 1. Princípios gerais do padrão YGP

Todo código desenvolvido seguindo o padrão YGP deve respeitar os seguintes princípios:

1. O código deve ser fácil de ler.
2. O código deve ser fácil de explicar.
3. O código deve seguir uma estrutura previsível.
4. A nomenclatura deve ser padronizada em português.
5. O uso de recursos complexos deve ser evitado quando uma solução simples resolver o problema.
6. HTML, CSS e JavaScript devem ser organizados de forma clara.
7. Cada tela deve ter validações compatíveis com sua regra de negócio.
8. A estrutura do projeto deve separar estilos globais de estilos específicos.
9. O CSS deve ser escrito com seletores simples.
10. O JavaScript deve priorizar funções diretas e compreensíveis.

---

## 2. Padrão de HTML

O HTML deve utilizar tags simples, semânticas e organizadas. Sempre que possível, a estrutura da página deve ser montada com tags que indiquem claramente a função de cada parte do conteúdo.

### 2.1 Tags semânticas recomendadas

```html
<header>
<nav>
<main>
<section>
<article>
<aside>
<footer>
```

### 2.2 Exemplo de estrutura base

```html
<body>
    <header class="cabecalho">
        <nav class="navegacao">
            <!-- links de navegação -->
        </nav>
    </header>

    <main class="conteudoPrincipal">
        <section class="secaoFormulario">
            <!-- conteúdo principal da tela -->
        </section>
    </main>

    <footer class="rodape">
        <!-- informações finais -->
    </footer>
</body>
```

### 2.3 Recomendações para o HTML

- Usar tags semânticas sempre que fizer sentido.
- Evitar estruturas confusas ou excesso de elementos desnecessários.
- Usar classes e IDs com nomes claros e em português.
- Manter a indentação organizada.
- Separar bem as áreas da página: cabeçalho, navegação, conteúdo principal e rodapé.

---

## 3. Nomenclatura

A nomenclatura deve ser padronizada em **português** e seguir obrigatoriamente o padrão **camelCase**.

### 3.1 Regras de nomenclatura

- Usar nomes claros, simples e descritivos.
- Usar **camelCase** para classes, IDs, variáveis e funções.
- Evitar abreviações desnecessárias.
- Priorizar nomes que indiquem a função real do elemento.
- Manter o mesmo padrão em todas as telas do projeto.
- Não misturar português e inglês nos nomes.
- Evitar nomes genéricos como `box`, `item`, `coisa`, `teste`, `valor1` ou `valor2`, quando houver opção mais clara.

### 3.2 Exemplos de nomes para classes

```html
<section class="secaoCadastro">
<div class="areaFormulario">
<div class="grupoCampo">
<div class="mensagemErro">
<footer class="rodape">
```

### 3.3 Exemplos de nomes para IDs

```html
<input id="inputNome">
<input id="inputEmail">
<input id="inputSenha">
<div id="divOutput"></div>
```

### 3.4 Exemplos de nomes para funções

```js
function validacoes() {}
function cadastrarUsuario() {}
function limparFormulario() {}
function exibirResultado() {}
```

---

## 4. Padrão de CSS

O CSS deve ser simples, direto e organizado.

O uso de **reset CSS é proibido** no padrão YGP.

### 4.1 Regras principais de CSS

- Não utilizar reset CSS.
- Usar somente as unidades: `px`, `%` , `vh` e `vw`.
- Exceto pelo `body`, estilizar os elementos sempre por **classes**.
- Não estilizar diretamente tags como `div`, `section`, `input`, `button`, `p`, `h1`, entre outras.
- O `body` pode ser estilizado diretamente, pois representa o padrão geral do projeto, como fonte, margem e configurações básicas.
- Manter os seletores simples e fáceis de entender.
- Evitar seletores longos, excessivamente específicos ou difíceis de reaproveitar.

### 4.2 Exemplo permitido

```css
body {
    margin: 0;
    font-family: Arial, sans-serif;
}

.cabecalho {
    width: 100%;
    padding: 20px;
}

.conteudoPrincipal {
    width: 80%;
    min-height: 80vh;
}

.botaoPrincipal {
    padding: 10px 20px;
}
```

### 4.3 Exemplo a evitar

```css
section {
    padding: 20px;
}

input {
    width: 100%;
}

button {
    cursor: pointer;
}
```

### 4.4 Motivo para evitar estilização direta de tags

A estilização direta de tags pode afetar elementos de várias páginas ao mesmo tempo, causando efeitos inesperados. Por isso, o padrão YGP prioriza o uso de classes, que deixam mais claro onde cada estilo será aplicado.

---

## 5. Estrutura de arquivos e organização CSS

A estrutura do projeto deve separar os estilos globais dos estilos específicos de cada página.

### 5.1 Arquivo global obrigatório

Deve existir um arquivo fixo chamado:

```txt
style.css
```

Esse arquivo deve ser dedicado exclusivamente aos elementos globais e estruturais que se repetem nas telas, como:

- `body`;
- navegação;
- cabeçalho;
- rodapé;
- estruturas reutilizáveis em várias páginas.

### 5.2 Arquivos CSS específicos

Para elementos e seções específicos de cada tela, devem ser criados arquivos próprios.

Exemplos:

```txt
login.css
cadastro.css
home.css
perfil.css
```

### 5.3 Exemplo de organização possível

```txt
projeto/
├── index.html
├── login.html
├── cadastro.html
├── css/
│   ├── style.css
│   ├── login.css
│   └── cadastro.css
└── js/
    └── script.js
```

### 5.4 Regras obrigatórias para arquivos CSS

- O arquivo `style.css` deve guardar apenas estilos globais.
- Cada página pode ter seu próprio arquivo CSS específico.
- É proibido usar reset CSS em qualquer arquivo.
- As únicas unidades permitidas são `px`, `%` , `vh` e `vw`.
- Apenas a tag `body` pode ser estilizada diretamente.
- Todos os demais elementos devem ser estilizados por classes.

---

## 6. Padrão de JavaScript

O JavaScript deve ser simples, direto e fácil de acompanhar.

Como o projeto tem foco em simplicidade, os elementos podem ser acessados diretamente pelas variáveis globais criadas a partir dos IDs dos inputs e demais elementos da tela.

### 6.1 Regras principais de JavaScript

- Usar nomes em português.
- Usar **camelCase** para variáveis e funções.
- Priorizar `const` quando o valor não precisar ser alterado.
- Usar `let` quando o valor precisar mudar durante a execução.
- Evitar abreviações desnecessárias.
- Usar funções com nomes claros e objetivos.
- Manter a lógica simples e organizada.
- Evitar códigos longos demais dentro de uma mesma função.
- Usar `alert()` para avisar erros de validação quando necessário.
- Encerrar a execução com `return` ou `return false` quando uma validação falhar.

### 6.2 Acesso aos elementos do DOM

No padrão YGP, os elementos devem ser acessados diretamente pelas variáveis globais criadas a partir dos IDs do HTML.

Exemplo:

```html
<input id="inputNome">
<div id="divOutput"></div>
```

```js
function exibirNome() {
    const nomeInformado = inputNome.value.trim()
    divOutput.innerHTML = `Nome informado: ${nomeInformado}`
}
```

### 6.3 Validações obrigatórias

Toda tela que possuir campos de entrada deve conter validações ativas.

A validação de cada tela deve ficar centralizada em uma função com o nome exato:

```js
function validacoes() {}
```

### 6.4 Regras para a função `validacoes()`

A função `validacoes()` deve:

- reunir as validações principais da tela;
- usar constantes ou variáveis booleanas com nomes claros;
- respeitar a regra de negócio específica de cada funcionalidade;
- exibir `alert()` quando houver erro;
- limpar campos, quando fizer sentido;
- encerrar o fluxo com `return false` quando houver erro;
- retornar `true` quando todos os dados estiverem válidos.


### 6.5 Validações com `vetorErros`

Quando a tela possuir formulários com várias entradas, o padrão YGP recomenda o uso de um vetor para acumular os erros de validação.

Esse vetor deve se chamar preferencialmente:

```js
const vetorErros = []
```

O objetivo é melhorar a experiência do usuário, evitando que o sistema mostre apenas um erro por vez e obrigue a pessoa a corrigir o formulário em várias tentativas.

Em vez de interromper a validação logo no primeiro erro, cada problema encontrado deve ser adicionado ao vetor com `.push()`.

Exemplo:

```js
if (nomeInformado.length < 3) {
    vetorErros.push('O nome deve ter pelo menos 3 caracteres.')
}

if (!emailInformado.includes('@')) {
    vetorErros.push('O e-mail deve conter @.')
}
```

Ao final das validações, o sistema deve verificar se o vetor possui algum erro usando `.length`.

Se `vetorErros.length` for maior que `0`, os erros devem ser apresentados juntos, usando `join('\n')` para separar cada mensagem em uma nova linha.

Exemplo:

```js
if (vetorErros.length > 0) {
    alert(vetorErros.join('\n'))
    return false
}
```

Essa estratégia deve ser usada principalmente quando houver formulários maiores, telas de cadastro ou várias entradas obrigatórias.

Para validações muito simples, com apenas um campo ou uma única regra, ainda é permitido usar um `alert()` direto e encerrar com `return false`.

---

## 7. Estruturas de repetição

Quando for necessário utilizar estruturas de repetição, o laço `for` deve obrigatoriamente ser construído com seus três parâmetros clássicos:

```js
for (let i = 0; i < lista.length; i++) {
    // lógica da repetição
}
```

### 7.1 Estrutura obrigatória do `for`

O `for` deve conter:

1. inicialização;
2. condição de parada;
3. incremento.

Exemplo:

```js
for (let i = 0; i < nomeInformado.length; i++) {
    const caracterAtual = nomeInformado[i]
}
```

---

## 8. Modelo de validação

O código abaixo demonstra o padrão recomendado para validações no projeto.

A regra de negócio usada no exemplo é apenas ilustrativa. As validações reais devem sempre depender da tela ou funcionalidade que está sendo desenvolvida.

```js
function validacoes() {
    const emailInformado = inputEmail.value.trim().toLowerCase()
    const nomeInformado = inputNome.value.trim()
    const senhaInformada = inputSenha.value.trim()

    const emailPossuiArroba = emailInformado.includes('@')
    const emailPossuiPonto = emailInformado.includes('.')
    const emailTamanhoValido = emailInformado.length > 5 && emailInformado.length < 50
    const nomeTamanhoValido = nomeInformado.length > 2 && nomeInformado.length < 50

    let nomePossuiApenasLetras = true

    for (let i = 0; i < nomeInformado.length; i++) {
        const caracterAtual = nomeInformado[i]

        const caracterNaoELetra = caracterAtual.toLowerCase() === caracterAtual.toUpperCase()
        const caracterNaoEEspaco = caracterAtual !== ' '

        if (caracterNaoELetra && caracterNaoEEspaco) {
            nomePossuiApenasLetras = false
            break
        }
    }

    let senhaTemTresLetras = false
    let quantidadeLetras = 0

    for (let i = 0; i < senhaInformada.length; i++) {
        const caracterAtual = senhaInformada[i]
        const caracterELetra = caracterAtual.toLowerCase() !== caracterAtual.toUpperCase()

        if (caracterELetra) {
            quantidadeLetras++
        }

        if (quantidadeLetras >= 3) {
            senhaTemTresLetras = true
            break
        }
    }

    const inputsValidos = emailPossuiArroba &&
        emailPossuiPonto &&
        emailTamanhoValido &&
        senhaTemTresLetras &&
        nomeTamanhoValido &&
        nomePossuiApenasLetras

    if (!inputsValidos) {
        alert('Por favor, preencha os campos corretamente.')
        inputEmail.value = ''
        return false
    }

    return true
}
```

---


### 8.1 Modelo de validação com `vetorErros`

O modelo abaixo deve ser usado como referência quando houver vários campos no formulário.

```js
function validacoes() {
    const vetorErros = []

    const nomeInformado = inputNome.value.trim()
    const emailInformado = inputEmail.value.trim().toLowerCase()
    const senhaInformada = inputSenha.value.trim()

    const nomeTamanhoValido = nomeInformado.length >= 3
    const emailPossuiArroba = emailInformado.includes('@')
    const emailPossuiPonto = emailInformado.includes('.')
    const senhaTamanhoValido = senhaInformada.length >= 8

    if (!nomeTamanhoValido) {
        vetorErros.push('O nome deve ter pelo menos 3 caracteres.')
    }

    if (!emailPossuiArroba || !emailPossuiPonto) {
        vetorErros.push('Informe um e-mail válido.')
    }

    if (!senhaTamanhoValido) {
        vetorErros.push('A senha deve ter pelo menos 8 caracteres.')
    }

    if (vetorErros.length > 0) {
        alert(vetorErros.join('\n'))
        return false
    }

    return true
}
```

Nesse modelo, todas as validações são feitas antes da exibição da mensagem. Assim, o usuário consegue visualizar todos os problemas de preenchimento de uma só vez.

---

## 9. Boas práticas complementares

Além das regras obrigatórias, recomenda-se seguir estas boas práticas:

- Manter o HTML organizado e indentado.
- Criar nomes que expliquem o papel do elemento ou da função.
- Separar responsabilidades entre HTML, CSS e JavaScript.
- Evitar misturar lógica de validação com lógica de exibição, quando possível.
- Escrever mensagens de erro claras para o usuário.
- Usar `vetorErros` em formulários com várias entradas para apresentar todos os erros de uma só vez.
- Evitar código duplicado.
- Evitar soluções avançadas quando uma solução simples for suficiente.
- Revisar o código antes de finalizar a tela.

---

## 10. Padrão de tela de acesso

No padrão YGP, **login e cadastro devem sempre fazer parte de uma única tela de acesso**.

Não devem ser criadas páginas separadas para login e cadastro. A tela de acesso deve conter duas áreas principais:

- `telaLogin`
- `telaCadastro`

A alternância entre login e cadastro deve ser feita por JavaScript, exibindo uma área por vez.

### Função padrão para alternar login e cadastro

```js
function alternarTelas() {
    const modoLogin = telaLogin.style.display != 'none'

    if (modoLogin) {
        telaLogin.style.display = 'none'
        telaCadastro.style.display = 'flex'
    } else {
        telaCadastro.style.display = 'none'
        telaLogin.style.display = 'flex'
    }
}
```

---

## 11. Checklist de revisão YGP

Antes de considerar uma tela pronta, verifique:

- [ ] O HTML usa tags semânticas quando possível.
- [ ] As classes estão em português e em camelCase.
- [ ] Os IDs estão em português e em camelCase.
- [ ] As funções estão em português e em camelCase.
- [ ] O CSS não usa reset.
- [ ] O CSS usa apenas `px`, `%` , `vh` e `vw`.
- [ ] Apenas o `body` foi estilizado diretamente.
- [ ] Os demais elementos foram estilizados por classes.
- [ ] O arquivo `style.css` contém apenas estilos globais.
- [ ] Os estilos específicos da página estão em arquivo próprio.
- [ ] A tela possui função `validacoes()`, se houver campos de entrada.
- [ ] As validações usam booleanos com nomes claros.
- [ ] Formulários com várias entradas usam `vetorErros`, `.push()`, `.length` e `join('\n')` quando adequado.
- [ ] Os laços `for` possuem os três parâmetros clássicos.
- [ ] Os erros de validação exibem `alert()`.
- [ ] O fluxo é encerrado com `return false` quando há erro.
- [ ] O código está simples, legível e organizado.

---

## Resumo das regras

### HTML

- Usar tags semânticas como `header`, `nav`, `main`, `section`, `article`, `aside` e `footer`.
- Manter a estrutura organizada e indentada.
- Usar classes e IDs claros, em português e em camelCase.
- Evitar elementos desnecessários.

### Nomenclatura

- Usar português em classes, IDs, variáveis e funções.
- Usar obrigatoriamente camelCase.
- Evitar abreviações.
- Usar nomes que expliquem a função real do elemento.

### CSS

- Não usar reset CSS.
- Usar apenas `px`, `%` , `vh` e `vw`.
- Estilizar diretamente apenas o `body`.
- Estilizar todos os demais elementos por classes.
- Usar `style.css` apenas para estilos globais.
- Criar arquivos CSS próprios para estilos específicos de cada página.
- Evitar seletores por tag, como `section`, `input`, `button`, `p` ou `h1`.

### JavaScript

- Usar código simples, direto e legível.
- Acessar elementos diretamente pelos IDs globais do HTML.
- Usar `const` para valores fixos e `let` para valores que mudam.
- Toda tela com campos de entrada deve ter validações.
- A função de validação deve se chamar obrigatoriamente `validacoes()`.
- As validações devem usar booleanos com nomes claros.
- Em formulários com várias entradas, usar `vetorErros = []` para acumular mensagens com `.push()`.
- Quando `vetorErros.length > 0`, exibir os erros com `alert(vetorErros.join('\n'))` e encerrar com `return false`.
- Quando os dados forem válidos, retornar `true`.

### Estruturas de repetição

- Usar `for` com os três parâmetros clássicos: inicialização, condição e incremento.
- Exemplo obrigatório de estrutura:

```js
for (let i = 0; i < lista.length; i++) {
    // lógica
}
```

### Regra principal do padrão YGP

O código deve ser **simples, claro, padronizado e fácil de entender**.

A prioridade não é escrever o código mais avançado possível, mas sim o código mais compreensível, organizado e adequado para o projeto.
