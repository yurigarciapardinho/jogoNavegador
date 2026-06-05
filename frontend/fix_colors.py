import os
import re

directory = '/home/yuzlkk/projetos/projetoTeste/frontend/src/components'

# mapping of old to new variable names
replacements = {
    r'var\(--cor-sucesso\)': 'var(--corSucesso)',
    r'var\(--cor-sucesso,\s*#[a-zA-Z0-9]+\)': 'var(--corSucesso)',
    r'var\(--cor-perigo\)': 'var(--corPerigo)',
    r'var\(--cor-primaria\)': 'var(--corPrimaria)',
    r'var\(--cor-primariaHover\)': 'var(--corPrimariaHover)',
    r'var\(--cor-primaria-hover\)': 'var(--corPrimariaHover)',
    r'var\(--cor-texto-principal\)': 'var(--corTextoPrincipal)',
    r'var\(--cor-texto-secundario\)': 'var(--corTextoSecundario)',
    r'var\(--cor-fundoSecundaria\)': 'var(--corFundoEscuro)',
    r'var\(--cor-borda\)': 'var(--corBorda)'
}

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
                
            original_content = content
            for old, new in replacements.items():
                content = re.sub(old, new, content)
                
            if content != original_content:
                with open(filepath, 'w') as f:
                    f.write(content)
                print(f"Updated {filepath}")
