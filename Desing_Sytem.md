<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Lamego Deli - Login</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "secondary-fixed": "#ffdad5",
              "primary-fixed": "#ffdad7",
              "secondary-fixed-dim": "#ffb4a9",
              "on-tertiary-fixed-variant": "#614000",
              "secondary": "#b02d21",
              "inverse-surface": "#2f3131",
              "surface-container-lowest": "#ffffff",
              "surface-dim": "#dadada",
              "surface-tint": "#904a46",
              "error-container": "#ffdad6",
              "on-error-container": "#93000a",
              "tertiary-fixed-dim": "#ffba44",
              "surface-container-low": "#f3f3f3",
              "surface-container-highest": "#e2e2e2",
              "outline": "#867371",
              "on-primary-container": "#be6f6a",
              "error": "#ba1a1a",
              "on-error-container": "#93000a",
              "tertiary": "#050200",
              "tertiary-fixed": "#ffddaf",
              "on-primary-fixed": "#3b0809",
              "inverse-on-surface": "#f1f1f1",
              "on-secondary-container": "#650001",
              "surface-container": "#eeeeee",
              "surface-bright": "#f9f9f9",
              "on-secondary-fixed": "#410000",
              "surface-container-high": "#e8e8e8",
              "on-surface-variant": "#534341",
              "on-tertiary": "#ffffff",
              "on-tertiary-fixed": "#281800",
              "inverse-primary": "#ffb3ad",
              "surface-variant": "#e2e2e2",
              "secondary-container": "#fc6451",
              "surface": "#f9f9f9",
              "tertiary-container": "#2a1a00",
              "background": "#f9f9f9",
              "on-secondary-fixed-variant": "#8e130c",
              "on-error": "#ffffff",
              "on-surface": "#1a1c1c",
              "on-primary": "#ffffff",
              "outline-variant": "#d9c1bf",
              "primary": "#0d0000",
              "on-secondary": "#ffffff",
              "primary-fixed-dim": "#ffb3ad",
              "primary-container": "#3d0a0a",
              "on-background": "#1a1c1c",
              "on-primary-fixed-variant": "#733330"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Public Sans"],
              "label": ["Space Grotesk"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
      body {
        font-family: 'Public Sans', sans-serif;
      }
      .editorial-title {
        font-family: 'Inter', sans-serif;
        letter-spacing: -0.02em;
      }
      .brand-accent {
        background-color: #3D0A0A;
      }
      .cta-accent {
        background-color: #C0392B;
      }
      .ambient-shadow {
        box-shadow: 0 12px 40px rgba(61, 10, 10, 0.06);
      }
    </style>
</head>
<body class="bg-surface-container-low min-h-screen flex flex-col items-center justify-center p-4">
<!-- Login Container -->
<main class="w-full max-w-[440px]">
<!-- Branding Header -->
<div class="flex flex-col items-center mb-10">
<div class="w-24 h-24 mb-6 relative">
<img alt="Lamego Deli Logo" class="w-full h-full object-contain" data-alt="elegant minimalist logo for a premium delicatessen featuring the letter L with artisanal flourish deep burgundy and gold accents white background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHL8Bni5FdZRAyR3YIlOPCLxZRJk0XfLSK5W2GcxUJSAVZFw3bQ7eZpcKv08orFJp4Ikqf4lEprHw--ee_hzl2dO0Vp6VtB0wNzhe6sB1GEGa_WorJIBsFSo2A-YxP1gLhxnKD0IEhfhNWQIdxuvp5p4_1Ft6tMDJT3BXr70WjyOFovCSPvlLfGlwe0Eh6bi2MSFC_Qs5U17AaViN7CuRKBeI8li2X32nk__CLHQpSAe3wlGkVMlKKCQ9npxPJIcN2Dpko4VNjDfLp"/>
</div>
<h1 class="editorial-title text-4xl font-extrabold text-primary-container tracking-tighter uppercase mb-1">
                Lamego Deli
            </h1>
<p class="font-body text-sm text-on-surface-variant font-medium tracking-widest uppercase">
                Est. 1998 • Excelência Artesanal
            </p>
</div>
<!-- Auth Card -->
<section class="bg-surface-container-lowest rounded-xl p-8 md:p-10 ambient-shadow border border-outline-variant/15">
<div class="mb-8">
<h2 class="editorial-title text-2xl font-bold text-primary-container">
                    Acesse sua conta
                </h2>
<p class="text-on-surface-variant text-sm mt-2">
                    Painel de Gerenciamento Interno
                </p>
</div>
<form class="space-y-6">
<!-- Email Field -->
<div class="space-y-2">
<label class="block text-xs font-bold text-primary-container uppercase tracking-wider" for="email">
                        E-mail Corporativo
                    </label>
<div class="relative group">
<div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
<span class="material-symbols-outlined text-[20px]">mail</span>
</div>
<input class="w-full pl-11 pr-4 py-3.5 bg-surface-container text-primary-container border-none rounded-xl focus:ring-2 focus:ring-secondary-fixed focus:bg-surface-container-lowest transition-all duration-200 text-sm font-medium placeholder-on-surface-variant/50" id="email" name="email" placeholder="exemplo@lamegodeli.com.br" required="" type="email"/>
</div>
</div>
<!-- Password Field -->
<div class="space-y-2">
<div class="flex justify-between items-center">
<label class="block text-xs font-bold text-primary-container uppercase tracking-wider" for="password">
                            Senha
                        </label>
<a class="text-[10px] font-bold text-on-secondary-fixed-variant hover:text-secondary uppercase tracking-tighter transition-colors" href="#">
                            Esqueceu a senha?
                        </a>
</div>
<div class="relative group">
<div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
<span class="material-symbols-outlined text-[20px]">lock</span>
</div>
<input class="w-full pl-11 pr-4 py-3.5 bg-surface-container text-primary-container border-none rounded-xl focus:ring-2 focus:ring-secondary-fixed focus:bg-surface-container-lowest transition-all duration-200 text-sm font-medium placeholder-on-surface-variant/50" id="password" name="password" placeholder="••••••••" required="" type="password"/>
</div>
</div>
<!-- Remember Me -->
<div class="flex items-center space-x-3 py-1">
<input class="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary-fixed transition-colors" id="remember" type="checkbox"/>
<label class="text-sm text-on-surface font-medium select-none cursor-pointer" for="remember">
                        Manter conectado
                    </label>
</div>
<!-- Submit Button -->
<button class="w-full cta-accent hover:opacity-90 active:scale-[0.98] transition-all duration-200 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-secondary/20" type="submit">
<span class="editorial-title tracking-tight text-base">Entrar</span>
<span class="material-symbols-outlined text-[20px]">arrow_forward</span>
</button>
</form>
<!-- Decorative Element -->
<div class="mt-10 flex items-center justify-center space-x-4">
<div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent"></div>
<div class="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim"></div>
<div class="h-[1px] flex-1 bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent"></div>
</div>
</section>
<!-- Footer Meta -->
<footer class="mt-12 text-center space-y-4">
<p class="font-label text-xs font-medium text-on-surface-variant tracking-wider uppercase">
                Rede Lamego © 2025
            </p>
<div class="flex justify-center gap-6">
<a class="text-[10px] font-bold text-on-surface-variant/60 hover:text-primary-container transition-colors uppercase tracking-widest" href="#">Suporte</a>
<span class="text-outline-variant/30">•</span>
<a class="text-[10px] font-bold text-on-surface-variant/60 hover:text-primary-container transition-colors uppercase tracking-widest" href="#">Privacidade</a>
</div>
</footer>
</main>
<!-- Aesthetic Ambient Elements -->
<div class="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-container via-secondary to-tertiary-fixed-dim opacity-40"></div>
<div class="fixed bottom-0 right-0 p-8 hidden lg:block">
<div class="flex items-center gap-4 text-primary-container/20">
<span class="editorial-title text-6xl font-black italic opacity-5 select-none">DELÍCIAS</span>
</div>
</div>
</body></html>


<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "secondary-fixed": "#ffdad5",
              "primary-fixed": "#ffdad7",
              "secondary-fixed-dim": "#ffb4a9",
              "on-tertiary-fixed-variant": "#614000",
              "secondary": "#b02d21",
              "inverse-surface": "#2f3131",
              "surface-container-lowest": "#ffffff",
              "surface-dim": "#dadada",
              "surface-tint": "#904a46",
              "error-container": "#ffdad6",
              "on-error-container": "#93000a",
              "tertiary-fixed-dim": "#ffba44",
              "surface-container-low": "#f3f3f3",
              "surface-container-highest": "#e2e2e2",
              "outline": "#867371",
              "on-primary-container": "#be6f6a",
              "error": "#ba1a1a",
              "on-error-container": "#93000a",
              "tertiary": "#050200",
              "tertiary-fixed": "#ffddaf",
              "on-primary-fixed": "#3b0809",
              "inverse-on-surface": "#f1f1f1",
              "on-secondary-container": "#650001",
              "surface-container": "#eeeeee",
              "surface-bright": "#f9f9f9",
              "on-secondary-fixed": "#410000",
              "surface-container-high": "#e8e8e8",
              "on-surface-variant": "#534341",
              "on-tertiary": "#ffffff",
              "on-tertiary-fixed": "#281800",
              "inverse-primary": "#ffb3ad",
              "surface-variant": "#e2e2e2",
              "secondary-container": "#fc6451",
              "surface": "#f9f9f9",
              "tertiary-container": "#2a1a00",
              "background": "#f9f9f9",
              "on-secondary-fixed-variant": "#8e130c",
              "on-error": "#ffffff",
              "on-surface": "#1a1c1c",
              "on-primary": "#ffffff",
              "outline-variant": "#d9c1bf",
              "primary": "#3D0A0A",
              "on-secondary": "#ffffff",
              "primary-fixed-dim": "#ffb3ad",
              "primary-container": "#3d0a0a",
              "on-background": "#1a1c1c",
              "on-primary-fixed-variant": "#733330"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Public Sans"],
              "label": ["Space Grotesk"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body class="bg-surface-container-low font-body text-on-surface antialiased">
<!-- Suppression Check: Although JSON includes SideNav/TopNav, the prompt describes a guided onboarding flow. 
         However, the prompt specifically requests "Uses fixed SideNavBar and TopNavBar", so I will include them 
         but with inactive states as the user is in a focused journey. -->
<!-- SideNavBar -->
<aside class="h-screen w-[240px] fixed left-0 top-0 flex flex-col bg-[#3D0A0A] dark:bg-slate-950 text-white font-['Inter'] antialiased text-sm tracking-tight border-r border-white/10 shadow-2xl z-50">
<div class="flex flex-col h-full py-6">
<div class="px-6 mb-10">
<div class="text-xl font-bold tracking-tighter text-white uppercase">Lamego Deli</div>
<div class="text-xs text-white/50">Est. 1998</div>
</div>
<nav class="flex-1 space-y-1">
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors opacity-50 cursor-not-allowed">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Visão Geral</span>
</div>
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors opacity-50 cursor-not-allowed">
<span class="material-symbols-outlined" data-icon="add_shopping_cart">add_shopping_cart</span>
<span>Lançar Compra</span>
</div>
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors opacity-50 cursor-not-allowed">
<span class="material-symbols-outlined" data-icon="history">history</span>
<span>Histórico</span>
</div>
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors opacity-50 cursor-not-allowed">
<span class="material-symbols-outlined" data-icon="notifications_active">notifications_active</span>
<span>Alertas</span>
</div>
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors opacity-50 cursor-not-allowed">
<span class="material-symbols-outlined" data-icon="menu_book">menu_book</span>
<span>Catálogo</span>
</div>
</nav>
<div class="pt-6 mt-6 border-t border-white/10 space-y-1">
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Configurações</span>
</div>
<div class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
<span>Sair</span>
</div>
</div>
</div>
</aside>
<!-- TopNavBar -->
<header class="fixed top-0 right-0 left-[240px] h-16 flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm z-40">
<div class="flex justify-between items-center w-full px-8">
<div class="flex items-center gap-4">
<span class="text-lg font-bold text-[#3D0A0A] dark:text-white font-headline">Painel de Controle</span>
<span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold tracking-widest uppercase">Primeiro Acesso</span>
</div>
<div class="flex items-center gap-6">
<div class="flex gap-4">
<span class="material-symbols-outlined text-[#3D0A0A] cursor-pointer" data-icon="notifications">notifications</span>
<span class="material-symbols-outlined text-[#3D0A0A] cursor-pointer" data-icon="storefront">storefront</span>
</div>
<div class="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest">
<img alt="Avatar do Gerente" data-alt="professional headshot of a middle aged man with a friendly smile, clean lighting, blurred office background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGSHI9ENv3hOZzPZgVEmMUjTCInUw30KJmVz22gpKb4-scQu73-NW0xNnonkaiJcyUdQg0ZY6nu2s4Y2ympS0XlrHeYmkK8F9u_j9dseVvIHDgfQ_zVVrX32np0HvdYo0u5iV74_3B4hOwB7dNsJr2oKs5BJLdeVZ3ukZuIC6BpCgCztHhybzT4qI_ze3k_O3MCgGf7NTtaH__0GPrclHEC_XCa1BhsW9aSsJe0bA4ShqbMhyF2Ck79-SGFimyng9JlgVh3KqAPRYa"/>
</div>
</div>
</div>
</header>
<!-- Main Content Canvas -->
<main class="ml-[240px] pt-16 min-h-screen bg-surface-container-low flex flex-col items-center justify-center p-8">
<!-- Onboarding Container -->
<div class="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
<!-- Welcome Header -->
<div class="mb-12 text-center">
<h1 class="text-4xl font-headline font-extrabold text-primary tracking-tight mb-3">Olá Ricardo, configure sua loja para começar</h1>
<p class="text-on-surface-variant max-w-lg mx-auto">Bem-vindo à família Lamego Deli. Vamos preparar seu ambiente de gestão em apenas 3 passos rápidos.</p>
</div>
<!-- Progress Indicator -->
<div class="flex items-center justify-between mb-16 relative px-12">
<div class="absolute top-1/2 left-[15%] right-[15%] h-[2px] bg-surface-container-highest -translate-y-1/2 -z-10"></div>
<!-- Step 1 -->
<div class="flex flex-col items-center gap-3">
<div class="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold shadow-lg shadow-secondary/20">
<span class="material-symbols-outlined text-sm" data-icon="person">person</span>
</div>
<span class="text-xs font-bold text-primary font-headline">Dados pessoais</span>
</div>
<!-- Step 2 -->
<div class="flex flex-col items-center gap-3">
<div class="w-10 h-10 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold border-4 border-surface-container-low">
<span class="material-symbols-outlined text-sm" data-icon="storefront">storefront</span>
</div>
<span class="text-xs font-medium text-on-surface-variant font-headline">Configurar loja</span>
</div>
<!-- Step 3 -->
<div class="flex flex-col items-center gap-3">
<div class="w-10 h-10 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center font-bold border-4 border-surface-container-low">
<span class="material-symbols-outlined text-sm" data-icon="task_alt">task_alt</span>
</div>
<span class="text-xs font-medium text-on-surface-variant font-headline">Confirmar</span>
</div>
</div>
<!-- Bento Layout Onboarding Steps (Simulating step-by-step visibility) -->
<div class="grid grid-cols-12 gap-6 items-start">
<!-- Left Column: Form Section -->
<div class="col-span-12 lg:col-span-7 bg-surface-container-lowest p-10 rounded-xl shadow-[0_12px_40px_rgba(61,10,10,0.06)]">
<!-- Form Step 1: Personal Data -->
<div class="space-y-8" id="step-1-content">
<div class="space-y-2">
<h2 class="text-2xl font-headline font-bold text-primary">Informações Básicas</h2>
<p class="text-sm text-on-surface-variant">Estes dados serão usados para identificação interna e suporte.</p>
</div>
<div class="space-y-6">
<div class="space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Nome Completo</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-medium transition-all" placeholder="Seu nome" type="text" value="Ricardo Lamego"/>
</div>
<div class="space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Telefone / WhatsApp</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-label transition-all" placeholder="(00) 00000-0000" type="tel" value="(11) 98765-4321"/>
</div>
</div>
<div class="pt-6 flex justify-end">
<button class="bg-primary text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 hover:bg-secondary transition-all active:scale-95">
                                Próximo passo
                                <span class="material-symbols-outlined" data-icon="arrow_forward">arrow_forward</span>
</button>
</div>
</div>
<!-- Step 2 and 3 would logically alternate here in a real app, 
                         for this UI design we will represent a "Review" or "Store config" summary 
                         within the same visual context but focused on Step 2 elements as requested -->
<div class="hidden space-y-8" id="step-2-content">
<!-- Content for Step 2 would go here -->
</div>
</div>
<!-- Right Column: Visual Preview / Contextual Card -->
<div class="col-span-12 lg:col-span-5 space-y-6">
<!-- Image Card -->
<div class="relative h-[240px] rounded-xl overflow-hidden group shadow-lg">
<img alt="Interior of a high-end bakery" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" data-alt="Interior of a warm high-end artisanal bakery with rustic wooden shelves, warm hanging lights, and crusty breads displayed on white linen" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpVTmRw5-bSuxI5dyNmWYW3tUEIh3ndWfOZk3hWWz1tTEa7unnQSbfnHYSjDJf0KNdNOW-8ge0Xr8zj-N8kcCbg7sFD0jhya02DQ19Wn_qHGKV4TAISwbG7vlv7Myj8wKfbDNhedLhbbvlKcNBFpsDtb3VZq4VkpZxPsCGcDktZFDcX78TnHGrVLBWmtpjLnRDIbdqVnVe81vTtsuJ0CBMPAHST1vDR9ThkTLoGf9OCTzN01fO4dZOU33saNBEkBcnvQoVvW13sd7s"/>
<div class="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div class="absolute bottom-6 left-6 right-6">
<h3 class="text-white font-headline font-bold text-lg">Tradição Lamego</h3>
<p class="text-white/80 text-xs">Seu legado digital começa aqui.</p>
</div>
</div>
<!-- Summary Card (Step 3 Preview) -->
<div class="bg-tertiary-fixed p-8 rounded-xl space-y-6">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-on-tertiary-container" data-icon="auto_awesome">auto_awesome</span>
<span class="font-headline font-bold text-on-tertiary-container">Resumo da Configuração</span>
</div>
<div class="space-y-4">
<div class="flex justify-between items-start">
<div>
<p class="text-[10px] uppercase font-bold text-on-tertiary-container/60 tracking-widest">Loja</p>
<p class="text-sm font-bold text-on-tertiary-container">Lamego Deli - Matriz</p>
</div>
<span class="material-symbols-outlined text-sm text-on-tertiary-container/40" data-icon="edit">edit</span>
</div>
<div class="flex justify-between items-start">
<div>
<p class="text-[10px] uppercase font-bold text-on-tertiary-container/60 tracking-widest">Endereço</p>
<p class="text-sm font-medium text-on-tertiary-container">Rua das Amendoeiras, 452, Jardins - SP</p>
</div>
<span class="material-symbols-outlined text-sm text-on-tertiary-container/40" data-icon="edit">edit</span>
</div>
<div class="flex justify-between items-start">
<div>
<p class="text-[10px] uppercase font-bold text-on-tertiary-container/60 tracking-widest">Horário</p>
<p class="text-sm font-label text-on-tertiary-container">07:00 : 20:00</p>
</div>
<span class="material-symbols-outlined text-sm text-on-tertiary-container/40" data-icon="edit">edit</span>
</div>
</div>
<button class="w-full bg-on-tertiary-container text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98]">
<span class="material-symbols-outlined" data-icon="rocket_launch">rocket_launch</span>
                            Confirmar e acessar painel
                        </button>
</div>
</div>
</div>
<!-- Footer micro-interactions -->
<div class="mt-12 flex justify-center items-center gap-8 text-on-surface-variant/40">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-base" data-icon="security">security</span>
<span class="text-[10px] font-bold uppercase tracking-widest">Conexão Segura</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-base" data-icon="support_agent">support_agent</span>
<span class="text-[10px] font-bold uppercase tracking-widest">Ajuda 24/7</span>
</div>
</div>
</div>
</main>
<!-- Overlay / Modal for Focused Store Config (Simulated View) -->
<!-- This section is just to demonstrate the Step 2 complexity mentioned in the prompt within the same UI context -->
<div class="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[60] flex items-center justify-center hidden">
<div class="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl p-10 overflow-hidden">
<div class="flex justify-between items-start mb-8">
<div>
<span class="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-1 block">Passo 02</span>
<h2 class="text-3xl font-headline font-extrabold text-primary">Configurar sua Loja</h2>
</div>
<button class="p-2 hover:bg-surface-container rounded-full transition-colors">
<span class="material-symbols-outlined text-on-surface-variant" data-icon="close">close</span>
</button>
</div>
<div class="grid grid-cols-2 gap-6">
<div class="col-span-2 space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Nome da Loja</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-medium transition-all" placeholder="Ex: Lamego Deli Central" type="text"/>
</div>
<div class="col-span-2 space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Endereço</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-medium transition-all" placeholder="Rua, Número" type="text"/>
</div>
<div class="space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Bairro</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-medium transition-all" placeholder="Bairro" type="text"/>
</div>
<div class="space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Cidade</label>
<input class="w-full bg-surface-container border-none focus:ring-2 focus:ring-secondary/20 focus:bg-white rounded-xl py-4 px-5 text-on-surface font-medium transition-all" placeholder="Cidade" type="text"/>
</div>
<div class="col-span-2 space-y-2">
<label class="text-xs font-bold uppercase tracking-wider text-primary/60">Horário de Funcionamento</label>
<div class="flex gap-4">
<input class="flex-1 bg-surface-container border-none rounded-xl py-4 px-5 font-label" type="time"/>
<span class="self-center font-bold text-primary/40">até</span>
<input class="flex-1 bg-surface-container border-none rounded-xl py-4 px-5 font-label" type="time"/>
</div>
</div>
</div>
<div class="mt-10 flex gap-4">
<button class="flex-1 border border-outline-variant text-primary font-bold py-4 rounded-xl hover:bg-surface-container transition-all">Voltar</button>
<button class="flex-[2] bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all">Salvar e Continuar</button>
</div>
</div>
</div>
</body></html>


<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Lamego Deli - Painel de Controle</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "secondary-fixed": "#ffdad5",
                        "primary-fixed": "#ffdad7",
                        "secondary-fixed-dim": "#ffb4a9",
                        "on-tertiary-fixed-variant": "#614000",
                        "secondary": "#b02d21",
                        "inverse-surface": "#2f3131",
                        "surface-container-lowest": "#ffffff",
                        "surface-dim": "#dadada",
                        "surface-tint": "#904a46",
                        "error-container": "#ffdad6",
                        "on-error-container": "#93000a",
                        "tertiary-fixed-dim": "#ffba44",
                        "surface-container-low": "#f3f3f3",
                        "surface-container-highest": "#e2e2e2",
                        "outline": "#867371",
                        "on-primary-container": "#be6f6a",
                        "error": "#ba1a1a",
                        "on-error-container": "#93000a",
                        "tertiary": "#050200",
                        "tertiary-fixed": "#ffddaf",
                        "on-primary-fixed": "#3b0809",
                        "inverse-on-surface": "#f1f1f1",
                        "on-secondary-container": "#650001",
                        "surface-container": "#eeeeee",
                        "surface-bright": "#f9f9f9",
                        "on-secondary-fixed": "#410000",
                        "surface-container-high": "#e8e8e8",
                        "on-surface-variant": "#534341",
                        "on-tertiary": "#ffffff",
                        "on-tertiary-fixed": "#281800",
                        "inverse-primary": "#ffb3ad",
                        "surface-variant": "#e2e2e2",
                        "secondary-container": "#fc6451",
                        "surface": "#f9f9f9",
                        "tertiary-container": "#2a1a00",
                        "background": "#f9f9f9",
                        "on-secondary-fixed-variant": "#8e130c",
                        "on-error": "#ffffff",
                        "on-surface": "#1a1c1c",
                        "on-primary": "#ffffff",
                        "outline-variant": "#d9c1bf",
                        "primary": "#3D0A0A",
                        "on-secondary": "#ffffff",
                        "primary-fixed-dim": "#ffb3ad",
                        "primary-container": "#3d0a0a",
                        "on-background": "#1a1c1c",
                        "on-primary-fixed-variant": "#733330"
                    },
                    fontFamily: {
                        "headline": ["Inter"],
                        "body": ["Public Sans"],
                        "label": ["Space Grotesk"]
                    },
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        body { font-family: 'Public Sans', sans-serif; }
        h1, h2, h3 { font-family: 'Inter', sans-serif; }
        .font-mono-data { font-family: 'Space Grotesk', monospace; }
        .sidebar-active { background-color: #C0392B; color: white; border-radius: 0.375rem; }
    </style>
</head>
<body class="bg-surface-container-low text-on-surface antialiased">
<!-- SideNavBar -->
<aside class="h-screen w-[240px] fixed left-0 top-0 flex flex-col bg-[#3D0A0A] dark:bg-slate-950 text-white font-['Inter'] antialiased text-sm tracking-tight border-r border-white/10 shadow-2xl z-50">
<div class="flex flex-col h-full py-6">
<!-- Header/Brand -->
<div class="px-6 mb-10">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
<img class="w-full h-full object-cover" data-alt="Logotipo minimalista premium da Lamego Deli, fundo burgundy escuro com ícone de trigo dourado estilizado" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCU2JfmcV9RJsgkki7lOfFSJO6EJsRFqgriQJX22v0epmU5J0kWCUb22E0UYscvUBSJ_KUjcUvAk8L-ucY89mkS1sYUeN6Z6P7IT3Z0G7eSiPTJp96F1W_vWNrugIt53TnP4qQ1XOYArtNOSdzgQP493ifRr-lPjOe16VjrFF8qam2R6oT7SAm_TNXjieP4Rh9upCuoYbxqxqP2rWaJf9_Zqfc0Oi6gl0GwbovCM4ZIEE_V8_THdKj21vDThqHXs99_RQrcYDm1iusr"/>
</div>
<div>
<h1 class="text-xl font-bold tracking-tighter text-white uppercase leading-none">Lamego Deli</h1>
<p class="text-[10px] text-white/50 tracking-widest mt-1">EST. 1998</p>
</div>
</div>
</div>
<!-- Navigation Items -->
<nav class="flex-1 space-y-1">
<!-- Visão Geral (ACTIVE) -->
<a class="bg-[#C0392B] text-white rounded-md mx-2 flex items-center gap-3 px-4 py-3 font-semibold transition-all scale-95 duration-150 ease-in-out" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Visão Geral</span>
</a>
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="add_shopping_cart">add_shopping_cart</span>
<span>Lançar Compra</span>
</a>
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="history">history</span>
<span>Histórico</span>
</a>
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="notifications_active">notifications_active</span>
<span>Alertas</span>
</a>
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="menu_book">menu_book</span>
<span>Catálogo</span>
</a>
</nav>
<!-- Footer Navigation -->
<div class="mt-auto pt-6 border-t border-white/10 space-y-1">
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Configurações</span>
</a>
<a class="text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-3 px-4 py-3 mx-2 transition-colors" href="#">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
<span>Sair</span>
</a>
</div>
</div>
</aside>
<!-- TopNavBar -->
<header class="fixed top-0 right-0 left-[240px] h-16 flex items-center bg-white/80 backdrop-blur-md shadow-sm z-40 px-8 justify-between">
<div class="flex items-center gap-4">
<h2 class="text-lg font-bold text-[#3D0A0A] font-headline">Painel de Controle</h2>
<div class="h-4 w-[1px] bg-slate-200"></div>
<div class="relative">
<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-sm">search</span>
<input class="pl-10 pr-4 py-1.5 bg-surface-container border-none rounded-xl text-xs focus:ring-2 focus:ring-secondary-fixed w-64 transition-all" placeholder="Buscar fornecedores ou itens..." type="text"/>
</div>
</div>
<div class="flex items-center gap-6">
<button class="relative text-on-surface-variant hover:text-[#C0392B] transition-opacity">
<span class="material-symbols-outlined">notifications</span>
<span class="absolute top-0 right-0 w-2 h-2 bg-[#C0392B] rounded-full border-2 border-white"></span>
</button>
<button class="text-on-surface-variant hover:text-[#C0392B] transition-opacity">
<span class="material-symbols-outlined">storefront</span>
</button>
<div class="flex items-center gap-3 border-l border-slate-100 pl-6">
<div class="text-right">
<p class="text-xs font-bold text-primary">Gerência Lamego</p>
<p class="text-[10px] text-on-surface-variant">Administrador</p>
</div>
<img class="w-8 h-8 rounded-full border border-slate-200" data-alt="Retrato de perfil de um gerente de restaurante profissional usando avental de couro premium em um ambiente de padaria artesanal" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAeAPUDF918pkIR0HQcgC0GCDWhGYx0xdG0vieXFcnS8AOrV5U8er4g439ZTRjuPB8ochDsDpz7EW4jl5Ge9JtugBdHQcSTkr-W9xx42BcjiedyxjuFTYG_23gxk_JQ85N0ln022s7lUy0HR39VELmQ-m5MRC-y8YA0EqwmgfaIdWchAg21I9wihdUptmTbS4FgJGOpAZ2gJGDnariP1xn35NIpOdxz0ok8J51LWUDsu5RlUqCcAQZi8e1o1P-zjTGznnS6FCjEtMMQ"/>
</div>
</div>
</header>
<!-- Main Content -->
<main class="ml-[240px] pt-24 px-8 pb-12">
<!-- Header Section -->
<header class="mb-10 flex justify-between items-end">
<div>
<h3 class="text-3xl font-extrabold text-primary tracking-tight mb-2">Resumo Operacional</h3>
<p class="text-on-surface-variant max-w-lg">Bem-vindo de volta. Aqui está o que aconteceu na sua deli nos últimos 30 dias.</p>
</div>
<div class="flex gap-3">
<button class="px-5 py-2.5 bg-white text-primary border border-outline-variant/30 rounded-xl font-semibold text-sm hover:bg-surface-container transition-colors flex items-center gap-2">
<span class="material-symbols-outlined text-sm">download</span> Exportar Relatório
                </button>
<button class="px-5 py-2.5 bg-[#C0392B] text-white rounded-xl font-semibold text-sm shadow-lg shadow-secondary/20 flex items-center gap-2">
<span class="material-symbols-outlined text-sm">add</span> Nova Compra
                </button>
</div>
</header>
<!-- KPI Grid (Bento Style) -->
<section class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
<!-- Gasto Este Mês -->
<div class="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_12px_40px_rgba(61,10,10,0.04)] flex flex-col justify-between border border-white">
<div class="flex justify-between items-start mb-4">
<div class="w-10 h-10 bg-primary-container/10 rounded-xl flex items-center justify-center text-primary">
<span class="material-symbols-outlined">payments</span>
</div>
<span class="text-xs font-bold text-error flex items-center gap-1 bg-error-container px-2 py-1 rounded-full">
<span class="material-symbols-outlined text-xs">trending_up</span> 12%
                    </span>
</div>
<div>
<p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Gasto este mês</p>
<h4 class="text-2xl font-bold font-mono-data text-primary">R$ 42.850,20</h4>
</div>
</div>
<!-- Compras Realizadas -->
<div class="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_12px_40px_rgba(61,10,10,0.04)] flex flex-col justify-between border border-white">
<div class="flex justify-between items-start mb-4">
<div class="w-10 h-10 bg-tertiary-fixed/30 rounded-xl flex items-center justify-center text-on-tertiary-container">
<span class="material-symbols-outlined">shopping_bag</span>
</div>
<span class="text-xs font-bold text-on-tertiary-container flex items-center gap-1 bg-tertiary-fixed px-2 py-1 rounded-full">
                        Meta 80%
                    </span>
</div>
<div>
<p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Compras realizadas</p>
<h4 class="text-2xl font-bold font-mono-data text-primary">158 pedidos</h4>
</div>
</div>
<!-- Fornecedores Usados -->
<div class="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_12px_40px_rgba(61,10,10,0.04)] flex flex-col justify-between border border-white">
<div class="flex justify-between items-start mb-4">
<div class="w-10 h-10 bg-secondary-fixed/30 rounded-xl flex items-center justify-center text-secondary">
<span class="material-symbols-outlined">local_shipping</span>
</div>
</div>
<div>
<p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Fornecedores usados</p>
<h4 class="text-2xl font-bold font-mono-data text-primary">24 ativos</h4>
</div>
</div>
<!-- Posição no Ranking -->
<div class="bg-primary p-6 rounded-2xl shadow-xl flex flex-col justify-between">
<div class="flex justify-between items-start mb-4">
<div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
<span class="material-symbols-outlined">emoji_events</span>
</div>
<span class="text-[10px] font-bold text-white flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full uppercase tracking-tighter">
                        Eficiência Alta
                    </span>
</div>
<div>
<p class="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Posição no ranking</p>
<h4 class="text-2xl font-bold font-mono-data text-white">#4 Rede</h4>
</div>
</div>
</section>
<!-- Alerts & Insights Area -->
<section class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
<div class="lg:col-span-2">
<div class="flex items-center justify-between mb-6">
<h3 class="text-xl font-bold text-primary">Alertas de Inteligência</h3>
<button class="text-xs font-bold text-secondary flex items-center gap-1">Ver todos <span class="material-symbols-outlined text-xs">arrow_forward</span></button>
</div>
<div class="space-y-4">
<!-- Red Alert -->
<div class="flex items-center gap-6 p-5 bg-error-container/30 rounded-2xl border-l-4 border-error">
<div class="w-12 h-12 bg-error-container rounded-full flex items-center justify-center text-error shrink-0">
<span class="material-symbols-outlined">trending_up</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="text-[10px] font-bold text-error uppercase tracking-widest">Insumo Crítico</span>
<span class="text-[10px] text-on-surface-variant font-medium">Há 2 horas</span>
</div>
<p class="text-on-surface font-semibold">Farinha de trigo : 18% acima da média</p>
<p class="text-xs text-on-surface-variant">O preço médio subiu de R$ 4,20 para R$ 4,95 no fornecedor principal. Recomendamos trocar para 'Moinho Real'.</p>
</div>
</div>
<!-- Yellow Alert -->
<div class="flex items-center gap-6 p-5 bg-tertiary-fixed/20 rounded-2xl border-l-4 border-tertiary-fixed-dim">
<div class="w-12 h-12 bg-tertiary-fixed rounded-full flex items-center justify-center text-on-tertiary-container shrink-0">
<span class="material-symbols-outlined">verified</span>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="text-[10px] font-bold text-on-tertiary-container uppercase tracking-widest">Oportunidade</span>
<span class="text-[10px] text-on-surface-variant font-medium">Há 5 horas</span>
</div>
<p class="text-on-surface font-semibold">Açúcar refinado : Melhor preço disponível</p>
<p class="text-xs text-on-surface-variant">O fornecedor 'Distribuidora Doce' está com 15% de desconto no fardo de 20kg por tempo limitado.</p>
</div>
</div>
</div>
</div>
<!-- Visual Insight / Quick Action Card -->
<div class="bg-surface-container-high rounded-3xl p-8 flex flex-col justify-end relative overflow-hidden min-h-[300px]">
<img class="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40" data-alt="Textura abstrata artística com tons de burgundy, creme e dourado, sugerindo camadas de massa folhada ou grãos de café de perto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCX3Y3Uw5aVXq5iAnGLoFHAdSTYqmEBMnyjV1xripgvR_1PgEyTzcHhhEmoghFqg701aP20BPxPlSlupkhdr_tMpwvsB7dIB6qLp12yQCx7AJ18475NYWozhaeJ8LtujnxIXQrctYnOeNziaW2Iahuf77k3jOabwMgyvPV_WZvsXAXh5_srt9dow5KT3xj9cS_VkRg06uLM9Pby6oeZhTOPQv8ooTcQpxDIu1xnS3otY14IKsoLx_V6EZ3ELNdO_IEwjiYnUmA54Jf-"/>
<div class="relative z-10">
<h4 class="text-2xl font-bold text-primary mb-4 leading-tight">Pronto para lançar<br/>novas notas?</h4>
<p class="text-sm text-on-surface-variant mb-6">Mantenha seu estoque atualizado para gerar relatórios de eficiência precisos.</p>
<button class="w-full py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
<span class="material-symbols-outlined">receipt_long</span> Escanear Nota Fiscal
                    </button>
</div>
</div>
</section>
<!-- Recent Purchases Table -->
<section class="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_12px_40px_rgba(61,10,10,0.06)]">
<div class="flex items-center justify-between mb-8">
<div>
<h3 class="text-xl font-bold text-primary">Compras Recentes</h3>
<p class="text-xs text-on-surface-variant mt-1">Últimos 5 registros processados</p>
</div>
<button class="text-sm font-bold text-primary-container border-b-2 border-primary-container/20 pb-1 hover:border-primary-container transition-all">Ver Histórico Completo</button>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left">
<thead>
<tr class="text-[10px] uppercase tracking-widest text-on-surface-variant border-b border-surface-container">
<th class="pb-4 font-bold">Data</th>
<th class="pb-4 font-bold">Fornecedor</th>
<th class="pb-4 font-bold">Total</th>
<th class="pb-4 font-bold">Itens</th>
<th class="pb-4 font-bold">Status Recibo</th>
<th class="pb-4 font-bold text-right">Ações</th>
</tr>
</thead>
<tbody class="text-sm">
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-5 font-mono-data text-xs">14 Out, 2023</td>
<td class="py-5">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-[10px]">DR</div>
<span class="font-bold">Distribuidora Roma</span>
</div>
</td>
<td class="py-5 font-bold font-mono-data text-primary">R$ 1.250,00</td>
<td class="py-5 text-on-surface-variant">12 itens</td>
<td class="py-5">
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-container text-[10px] font-bold">
<span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">check_circle</span> Processado
                                </span>
</td>
<td class="py-5 text-right">
<button class="p-2 hover:bg-white rounded-lg transition-colors text-on-surface-variant group-hover:text-primary">
<span class="material-symbols-outlined">visibility</span>
</button>
</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-5 font-mono-data text-xs">13 Out, 2023</td>
<td class="py-5">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-[10px]">MR</div>
<span class="font-bold">Moinho Real</span>
</div>
</td>
<td class="py-5 font-bold font-mono-data text-primary">R$ 840,50</td>
<td class="py-5 text-on-surface-variant">4 itens</td>
<td class="py-5">
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-container text-[10px] font-bold">
<span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">check_circle</span> Processado
                                </span>
</td>
<td class="py-5 text-right">
<button class="p-2 hover:bg-white rounded-lg transition-colors text-on-surface-variant group-hover:text-primary">
<span class="material-symbols-outlined">visibility</span>
</button>
</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="py-5 font-mono-data text-xs">12 Out, 2023</td>
<td class="py-5">
<div class="flex items-ce


<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "secondary-fixed": "#ffdad5",
              "primary-fixed": "#ffdad7",
              "secondary-fixed-dim": "#ffb4a9",
              "on-tertiary-fixed-variant": "#614000",
              "secondary": "#b02d21",
              "inverse-surface": "#2f3131",
              "surface-container-lowest": "#ffffff",
              "surface-dim": "#dadada",
              "surface-tint": "#904a46",
              "error-container": "#ffdad6",
              "on-error-container": "#93000a",
              "tertiary-fixed-dim": "#ffba44",
              "surface-container-low": "#f3f3f3",
              "surface-container-highest": "#e2e2e2",
              "outline": "#867371",
              "on-primary-container": "#be6f6a",
              "error": "#ba1a1a",
              "on-error-container": "#93000a",
              "tertiary": "#050200",
              "tertiary-fixed": "#ffddaf",
              "on-primary-fixed": "#3b0809",
              "inverse-on-surface": "#f1f1f1",
              "on-secondary-container": "#650001",
              "surface-container": "#eeeeee",
              "surface-bright": "#f9f9f9",
              "on-secondary-fixed": "#410000",
              "surface-container-high": "#e8e8e8",
              "on-surface-variant": "#534341",
              "on-tertiary": "#ffffff",
              "on-tertiary-fixed": "#281800",
              "inverse-primary": "#ffb3ad",
              "surface-variant": "#e2e2e2",
              "secondary-container": "#fc6451",
              "surface": "#f9f9f9",
              "tertiary-container": "#2a1a00",
              "background": "#f9f9f9",
              "on-secondary-fixed-variant": "#8e130c",
              "on-error": "#ffffff",
              "on-surface": "#1a1c1c",
              "on-primary": "#ffffff",
              "outline-variant": "#d9c1bf",
              "primary": "#3d0a0a",
              "on-secondary": "#ffffff",
              "primary-fixed-dim": "#ffb3ad",
              "primary-container": "#3d0a0a",
              "on-background": "#1a1c1c",
              "on-primary-fixed-variant": "#733330"
            },
            fontFamily: {
              "headline": ["Inter", "sans-serif"],
              "body": ["Public Sans", "sans-serif"],
              "label": ["Space Grotesk", "monospace"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .bg-glass {
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        .premium-shadow {
            box-shadow: 0 12px 40px rgba(61, 10, 10, 0.06);
        }
    </style>
</head>
<body class="bg-surface-container-low font-body text-on-surface">
<!-- Sidebar Navigation -->
<aside class="h-screen w-[240px] fixed left-0 top-0 flex flex-col bg-[#3D0A0A] dark:bg-slate-950 border-r border-white/10 shadow-2xl z-50 font-['Inter'] antialiased text-sm tracking-tight">
<div class="flex flex-col h-full py-6">
<!-- Header -->
<div class="px-6 mb-8">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-white font-bold text-lg">L</div>
<div>
<h1 class="text-xl font-bold tracking-tighter text-white uppercase">Lamego Deli</h1>
<p class="text-[10px] text-white/50 tracking-widest uppercase font-semibold">Est. 1998</p>
</div>
</div>
</div>
<!-- Main Nav -->
<nav class="flex-1 space-y-1">
<a class="bg-[#C0392B] text-white rounded-md mx-2 flex items-center gap-3 px-4 py-3 font-semibold transition-all" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
                    Visão Geral
                </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="add_shopping_cart">add_shopping_cart</span>
                    Lançar Compra
                </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="history">history</span>
                    Histórico
                </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="notifications_active">notifications_active</span>
                    Alertas
                </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="menu_book">menu_book</span>
                    Catálogo
                </a>
</nav>
<!-- Footer Nav -->
<div class="mt-auto pt-6 border-t border-white/10 space-y-1">
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
                    Configurações
                </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
                    Sair
                </a>
</div>
</div>
</aside>
<!-- Top Bar -->
<header class="fixed top-0 right-0 left-[240px] h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center px-8 z-40 shadow-sm border-b border-surface-container">
<div class="flex justify-between items-center w-full">
<div class="flex items-center gap-4">
<h2 class="text-lg font-bold text-[#3D0A0A] dark:text-white font-headline">Painel de Controle</h2>
<div class="h-4 w-[1px] bg-outline-variant/30"></div>
<span class="text-on-surface-variant text-sm font-medium">Dashboard da Rede</span>
</div>
<div class="flex items-center gap-6">
<div class="relative group">
<input class="pl-10 pr-4 py-1.5 bg-surface-container border-none rounded-xl text-sm focus:ring-2 focus:ring-secondary-container transition-all w-64" placeholder="Buscar relatório..." type="text"/>
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" data-icon="search">search</span>
</div>
<div class="flex items-center gap-4">
<button class="text-on-surface-variant hover:text-[#C0392B] transition-colors relative">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
<span class="absolute top-0 right-0 w-2 h-2 bg-[#C0392B] rounded-full border-2 border-white"></span>
</button>
<button class="text-on-surface-variant hover:text-[#C0392B] transition-colors">
<span class="material-symbols-outlined" data-icon="storefront">storefront</span>
</button>
<div class="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
<img class="w-full h-full object-cover" data-alt="Close-up portrait of a professional male manager in a modern kitchen setting, soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQX49V4sV1auTmcWPdqFEByLecJP7uNm3cfSUreouzB4Snm_AXYW26brFBoRDYJQ_LXeJ86KqUgaLB-lWIPgt4BH_SsRJVOl2Brm3E4yGeh6MFFr3Y5LppeXj6J27qPbJfAm759R0Prpiim6uaZH1nPcGtXaViRu7ECQxJ5XSuREgMw8JP2LxxYD7DKvLj2_AoYNCUd9So06UOAeD9NJahVqBKfVQ6Kq4Q09Skikhh1LvkQqDRa5TktSZITHygK6VECZRH7dOGJABz"/>
</div>
</div>
</div>
</div>
</header>
<!-- Main Content -->
<main class="ml-[240px] pt-24 pb-12 px-8 min-h-screen">
<div class="max-w-7xl mx-auto">
<!-- Page Header -->
<div class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
<div>
<span class="text-[10px] font-bold tracking-[0.2em] text-[#C0392B] uppercase mb-1 block">Visão Administrativa</span>
<h1 class="text-4xl md:text-5xl font-extrabold text-primary tracking-tight font-headline">Dashboard da Rede</h1>
</div>
<div class="flex gap-3">
<button class="px-4 py-2 bg-surface-container-lowest text-primary font-semibold text-sm rounded-xl premium-shadow border border-outline-variant/10 hover:bg-surface-container transition-colors flex items-center gap-2">
<span class="material-symbols-outlined text-sm" data-icon="calendar_today">calendar_today</span>
                        Últimos 30 dias
                    </button>
<button class="px-6 py-2 bg-primary text-white font-semibold text-sm rounded-xl premium-shadow hover:opacity-90 transition-opacity flex items-center gap-2">
<span class="material-symbols-outlined text-sm" data-icon="download">download</span>
                        Exportar Dados
                    </button>
</div>
</div>
<!-- KPI Bento Grid -->
<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-12">
<!-- KPI 1 -->
<div class="bg-surface-container-lowest p-6 rounded-2xl premium-shadow group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 rounded-lg bg-primary-container/5 text-primary">
<span class="material-symbols-outlined" data-icon="payments">payments</span>
</div>
<span class="text-[10px] font-bold text-tertiary-fixed-dim bg-tertiary-container px-2 py-0.5 rounded-full">+12%</span>
</div>
<p class="text-on-surface-variant text-xs font-semibold mb-1 uppercase tracking-wider">Total gasto rede</p>
<p class="text-2xl font-bold font-label text-primary">R$ 142.580</p>
</div>
<!-- KPI 2 -->
<div class="bg-surface-container-lowest p-6 rounded-2xl premium-shadow group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 rounded-lg bg-primary-container/5 text-primary">
<span class="material-symbols-outlined" data-icon="store">store</span>
</div>
</div>
<p class="text-on-surface-variant text-xs font-semibold mb-1 uppercase tracking-wider">Lojas ativas</p>
<p class="text-2xl font-bold font-label text-primary">08</p>
</div>
<!-- KPI 3 -->
<div class="bg-surface-container-lowest p-6 rounded-2xl premium-shadow group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 rounded-lg bg-primary-container/5 text-primary">
<span class="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
</div>
</div>
<p class="text-on-surface-variant text-xs font-semibold mb-1 uppercase tracking-wider">Compras registradas</p>
<p class="text-2xl font-bold font-label text-primary">1.248</p>
</div>
<!-- KPI 4 -->
<div class="bg-surface-container-lowest p-6 rounded-2xl premium-shadow group border-l-4 border-secondary">
<div class="flex justify-between items-start mb-4">
<div class="p-2 rounded-lg bg-secondary-fixed text-secondary">
<span class="material-symbols-outlined" data-icon="trending_up">trending_up</span>
</div>
<span class="text-[10px] font-bold text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full">Alerta</span>
</div>
<p class="text-on-surface-variant text-xs font-semibold mb-1 uppercase tracking-wider">Maior variação preço</p>
<p class="text-2xl font-bold font-label text-secondary">+24,5%</p>
</div>
<!-- KPI 5 -->
<div class="bg-primary p-6 rounded-2xl premium-shadow group">
<div class="flex justify-between items-start mb-4">
<div class="p-2 rounded-lg bg-white/10 text-tertiary-fixed">
<span class="material-symbols-outlined" data-icon="savings">savings</span>
</div>
</div>
<p class="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wider">Economia potencial</p>
<p class="text-2xl font-bold font-label text-tertiary-fixed">R$ 18.240</p>
</div>
</div>
<!-- Charts & Analytical Section -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- Main Spending Chart (Multi-line) -->
<div class="lg:col-span-8 bg-surface-container-lowest p-8 rounded-3xl premium-shadow">
<div class="flex items-center justify-between mb-8">
<div>
<h3 class="text-xl font-bold text-primary font-headline">Evolução de gastos por loja</h3>
<p class="text-on-surface-variant text-sm">Comparativo mensal entre as 3 principais unidades</p>
</div>
<div class="flex gap-4">
<div class="flex items-center gap-2">
<span class="w-3 h-3 rounded-full bg-primary"></span>
<span class="text-xs font-medium">Matriz</span>
</div>
<div class="flex items-center gap-2">
<span class="w-3 h-3 rounded-full bg-secondary"></span>
<span class="text-xs font-medium">Unid. Jardins</span>
</div>
<div class="flex items-center gap-2">
<span class="w-3 h-3 rounded-full bg-tertiary-fixed-dim"></span>
<span class="text-xs font-medium">Unid. Leblon</span>
</div>
</div>
</div>
<!-- Simulated Multi-line Chart -->
<div class="h-80 relative flex items-end justify-between pt-4 border-b border-outline-variant/20">
<!-- Chart Grid Lines -->
<div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
<div class="border-t border-primary w-full"></div>
<div class="border-t border-primary w-full"></div>
<div class="border-t border-primary w-full"></div>
<div class="border-t border-primary w-full"></div>
</div>
<!-- Chart Lines (Simulated with paths/shapes) -->
<svg class="absolute inset-0 w-full h-full overflow-visible" preserveaspectratio="none">
<!-- Matriz Line (Primary) -->
<path d="M0 200 Q 150 180, 300 240 T 600 160 T 900 180" fill="none" stroke="#3D0A0A" stroke-width="4"></path>
<!-- Unid Jardins (Secondary) -->
<path d="M0 250 Q 150 220, 300 280 T 600 220 T 900 150" fill="none" stroke="#C0392B" stroke-dasharray="8 4" stroke-width="3"></path>
<!-- Unid Leblon (Tertiary) -->
<path d="M0 280 Q 150 260, 300 300 T 600 250 T 900 220" fill="none" stroke="#F0A500" stroke-width="3"></path>
</svg>
<!-- X Axis Labels -->
<div class="absolute -bottom-8 w-full flex justify-between text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter">
<span>Janeiro</span>
<span>Fevereiro</span>
<span>Março</span>
<span>Abril</span>
<span>Maio</span>
<span>Junho</span>
</div>
</div>
</div>
<!-- Efficiency Ranking (Horizontal Bar) -->
<div class="lg:col-span-4 bg-surface-container-lowest p-8 rounded-3xl premium-shadow">
<h3 class="text-xl font-bold text-primary font-headline mb-2">Ranking de eficiência</h3>
<p class="text-on-surface-variant text-sm mb-8">Performance de compras vs. Tabela referencial</p>
<div class="space-y-6">
<!-- Bar Item 1 -->
<div>
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary">Unidade Jardins</span>
<span class="text-xs font-label text-on-tertiary-container font-bold">98%</span>
</div>
<div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-tertiary-fixed-dim" style="width: 98%"></div>
</div>
</div>
<!-- Bar Item 2 -->
<div>
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary">Unidade Matriz</span>
<span class="text-xs font-label text-on-tertiary-container font-bold">85%</span>
</div>
<div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-tertiary-fixed-dim/80" style="width: 85%"></div>
</div>
</div>
<!-- Bar Item 3 -->
<div>
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary">Unidade Leblon</span>
<span class="text-xs font-label text-on-surface-variant font-bold">72%</span>
</div>
<div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-surface-container-highest" style="width: 72%"></div>
</div>
</div>
<!-- Bar Item 4 -->
<div>
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary">Unidade Centro</span>
<span class="text-xs font-label text-secondary font-bold">54%</span>
</div>
<div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-secondary-container" style="width: 54%"></div>
</div>
</div>
<!-- Bar Item 5 -->
<div>
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary">Unidade Barra</span>
<span class="text-xs font-label text-error font-bold">38%</span>
</div>
<div class="h-2 w-full bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-error" style="width: 38%"></div>
</div>
</div>
</div>
<div class="mt-8 pt-6 border-t border-outline-variant/10">
<div class="flex items-center gap-3 p-4 bg-tertiary-fixed/20 rounded-xl">
<span class="material-symbols-outlined text-on-tertiary-container" data-icon="lightbulb">lightbulb</span>
<p class="text-xs text-on-tertiary-container font-medium leading-relaxed">
                                A Unidade Barra teve 12 compras acima do teto negociado este mês.
                            </p>
</div>
</div>
</div>
</div>
<!-- Detailed Section: Recent Significant Variations -->
<div class="mt-12">
<div class="flex items-center justify-between mb-6 px-2">
<h3 class="text-2xl font-bold text-primary font-headline tracking-tight">Alertas de Variação Crítica</h3>
<a class="text-[#C0392B] text-sm font-bold hover:underline" href="#">Ver todos os alertas</a>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<!-- Item Alert 1 -->
<div class="flex items-center gap-6 p-5 bg-surface-container-lowest rounded-2xl premium-shadow border-l-4 border-secondary">
<div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
<img class="w-full h-full object-cover" data-alt="High quality fresh premium beef cut on a dark surface with moody lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbcmhmNLL3pqhyX95JI50AoEQEuzy3wWN9TcjgXKVpnuY0GjaSqPjrcCsCbRSWexJ25DMVGlg4CZMhQCuQqi8xlJuGQewTy33oh_ov8fxxcvEv5A5t4KUr7MtBQcy3ESmISBCTSKv1-OlUU7sQeAPhG-Ey__sIDuX1q5yTckiwYQ9ndhvRRQPhaHYOdoFIlvdOygA1uuWcBRz3ZFFHWHWYxsM_NrkIU7pJIBL2Y8Mvwn7Y8sLqEXecyFpgYRfbExoOlusKUMlbpwoH"/>
</div>
<div class="flex-1">
<div class="flex justify-between">
<h4 class="font-bold text-primary">Filé Mignon Especial (Kg)</h4>
<span class="text-xs font-label text-secondary font-bold">+28.4%</span>
</div>
<p class="text-xs text-on-surface-variant mb-2">Fornecedor: Carnes Nobre S/A</p>
<div class="flex items-center gap-4">
<span class="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">Preço Ant: R$ 89,90</span>
<span class="text-[10px] font-bold text-secondary uppercase tracking-widest">Atual: R$ 115,43</span>
</div>
</div>
<button class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-secondary-fixed transition-colors">
<span class="material-symbols-outlined text-secondary" data-icon="more_vert">more_vert</span>
</button>
</div>
<!-- Item Alert 2 -->
<div class="flex items-center gap-6 p-5 bg-surface-container-lowest rounded-2xl premium-shadow border-l-4 border-secondary">
<div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
<img class="w-full h-full object-cover" data-alt="Glass bottle of farm fresh milk on a wooden table at dawn, rustic aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6EHrHbRJySMCORlI4fr2uCSckT0RiYupexISt8yeh3xRfJGx1EC81JgnDC8hUwf2HcP_RvwMpPKnjRixoBHJsRa2Pjw11rQDNSTkprc9H-8zWCSPpGn8-47d3WMTTux_ZonCIjP8NeVuRdB4ZDhxXY5wOxUOvnEW5HycSaBT4tHkqycF6VwchMbCqiX2WeXEi3Tvql-JpeDLHMIWvAhPt-4nmEFpTJajgb1bR22laDgws4ZsRjWgBbWZKR0FkiL4GSWDlRcD8JqqN"/>
</div>
<div


<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Lamego Deli - Lançar Compra</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "secondary-fixed": "#ffdad5",
              "primary-fixed": "#ffdad7",
              "secondary-fixed-dim": "#ffb4a9",
              "on-tertiary-fixed-variant": "#614000",
              "secondary": "#b02d21",
              "inverse-surface": "#2f3131",
              "surface-container-lowest": "#ffffff",
              "surface-dim": "#dadada",
              "surface-tint": "#904a46",
              "error-container": "#ffdad6",
              "on-error-container": "#93000a",
              "tertiary-fixed-dim": "#ffba44",
              "surface-container-low": "#f3f3f3",
              "surface-container-highest": "#e2e2e2",
              "outline": "#867371",
              "on-primary-container": "#be6f6a",
              "error": "#ba1a1a",
              "on-error-container": "#93000a",
              "tertiary": "#050200",
              "tertiary-fixed": "#ffddaf",
              "on-primary-fixed": "#3b0809",
              "inverse-on-surface": "#f1f1f1",
              "on-secondary-container": "#650001",
              "surface-container": "#eeeeee",
              "surface-bright": "#f9f9f9",
              "on-secondary-fixed": "#410000",
              "surface-container-high": "#e8e8e8",
              "on-surface-variant": "#534341",
              "on-tertiary": "#ffffff",
              "on-tertiary-fixed": "#281800",
              "inverse-primary": "#ffb3ad",
              "surface-variant": "#e2e2e2",
              "secondary-container": "#fc6451",
              "surface": "#f9f9f9",
              "tertiary-container": "#2a1a00",
              "background": "#f9f9f9",
              "on-secondary-fixed-variant": "#8e130c",
              "on-error": "#ffffff",
              "on-surface": "#1a1c1c",
              "on-primary": "#ffffff",
              "outline-variant": "#d9c1bf",
              "primary": "#3D0A0A",
              "on-secondary": "#ffffff",
              "primary-fixed-dim": "#ffb3ad",
              "primary-container": "#3d0a0a",
              "on-background": "#1a1c1c",
              "on-primary-fixed-variant": "#733330"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Public Sans"],
              "label": ["Space Grotesk"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body { font-family: 'Public Sans', sans-serif; }
        h1, h2, h3 { font-family: 'Inter', sans-serif; }
        .currency { font-family: 'Space Grotesk', monospace; }
        .glass-panel {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(20px);
        }
    </style>
</head>
<body class="bg-surface-container-low text-on-surface">
<!-- SideNavBar Anchor -->
<aside class="h-screen w-[240px] fixed left-0 top-0 flex flex-col bg-[#3D0A0A] dark:bg-slate-950 text-white font-['Inter'] antialiased text-sm tracking-tight border-r border-white/10 shadow-2xl py-6 z-50">
<div class="px-6 mb-8">
<h1 class="text-xl font-bold tracking-tighter text-white uppercase">Lamego Deli</h1>
<p class="text-xs text-white/50">Est. 1998</p>
</div>
<nav class="flex-1 space-y-1">
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Visão Geral</span>
</a>
<a class="bg-[#C0392B] text-white rounded-md mx-2 flex items-center gap-3 px-4 py-3 font-semibold transition-all" href="#">
<span class="material-symbols-outlined" data-icon="add_shopping_cart">add_shopping_cart</span>
<span>Lançar Compra</span>
</a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="history">history</span>
<span>Histórico</span>
</a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="notifications_active">notifications_active</span>
<span>Alertas</span>
</a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="menu_book">menu_book</span>
<span>Catálogo</span>
</a>
</nav>
<div class="mt-auto border-t border-white/10 pt-4">
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Configurações</span>
</a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined" data-icon="logout">logout</span>
<span>Sair</span>
</a>
</div>
</aside>
<!-- TopNavBar Anchor -->
<header class="fixed top-0 right-0 left-[240px] h-16 flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm z-40">
<div class="flex justify-between items-center w-full px-8">
<div class="flex items-center gap-4">
<h2 class="text-lg font-bold text-[#3D0A0A] dark:text-white">Painel de Controle</h2>
</div>
<div class="flex items-center gap-6">
<div class="flex gap-4">
<span class="material-symbols-outlined text-slate-500 cursor-pointer hover:text-[#C0392B] transition-colors" data-icon="notifications">notifications</span>
<span class="material-symbols-outlined text-slate-500 cursor-pointer hover:text-[#C0392B] transition-colors" data-icon="storefront">storefront</span>
</div>
<div class="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30">
<img class="w-full h-full object-cover" data-alt="close up headshot of a professional store manager with a friendly expression in a modern deli setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvMByzwqQRyy1vjgoO5sGZtWoYB1FRDYPv6LGwy4Dtz7ux6rmDKj-D_saBFNuvpB-6sYKccEMkBIdSCkDhRN8Zd3gcUDBv7wEAWmPl3aVKT7lLJ30UpSoR9m4J5ppL3bMILEuw3rwmXljbeFZ-LQtfd0lyanSqKqFDdj0a7gLGT2e9R3y34FisJJLN9NWl3-4XALwf4P5VKovtTQphi1_dl6NcwLdVbLepIOaz1RKEGrPjzK3qjzAshInZl5-s8pxOpobb5aNMZzYP"/>
</div>
</div>
</div>
</header>
<!-- Main Content Canvas -->
<main class="ml-[240px] mt-16 p-8 min-h-[calc(100vh-64px)]">
<!-- Page Editorial Header -->
<div class="mb-10">
<h3 class="text-3xl font-extrabold text-primary tracking-tight mb-2">Novo Lançamento de Compra</h3>
<p class="text-on-surface-variant font-medium">Gerencie a entrada de insumos com precisão artesanal.</p>
</div>
<!-- 4-Step Multi-step Form Stepper -->
<div class="max-w-5xl mx-auto mb-12">
<div class="relative flex justify-between items-center">
<!-- Progress Line -->
<div class="absolute top-1/2 left-0 w-full h-0.5 bg-surface-container-highest -translate-y-1/2 z-0"></div>
<div class="absolute top-1/2 left-0 w-[45%] h-0.5 bg-secondary -translate-y-1/2 z-0 transition-all duration-500"></div>
<!-- Step 1: Completed -->
<div class="relative z-10 flex flex-col items-center">
<div class="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center shadow-lg">
<span class="material-symbols-outlined text-base" data-icon="check">check</span>
</div>
<span class="mt-2 text-xs font-bold text-primary uppercase tracking-widest">Cabeçalho</span>
</div>
<!-- Step 2: Active -->
<div class="relative z-10 flex flex-col items-center">
<div class="w-12 h-12 rounded-full bg-secondary text-white flex items-center justify-center shadow-xl ring-4 ring-secondary-fixed">
<span class="text-lg font-bold">2</span>
</div>
<span class="mt-2 text-xs font-bold text-secondary uppercase tracking-widest">Itens</span>
</div>
<!-- Step 3: Pending -->
<div class="relative z-10 flex flex-col items-center">
<div class="w-10 h-10 rounded-full bg-surface-container-lowest border-2 border-surface-container-highest text-on-surface-variant flex items-center justify-center">
<span class="text-sm font-bold">3</span>
</div>
<span class="mt-2 text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Nota Fiscal</span>
</div>
<!-- Step 4: Pending -->
<div class="relative z-10 flex flex-col items-center">
<div class="w-10 h-10 rounded-full bg-surface-container-lowest border-2 border-surface-container-highest text-on-surface-variant flex items-center justify-center">
<span class="text-sm font-bold">4</span>
</div>
<span class="mt-2 text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Revisão</span>
</div>
</div>
</div>
<div class="grid grid-cols-12 gap-8 max-w-7xl mx-auto">
<!-- Main Form Card (Step 2 Previewed as per prompt focus) -->
<div class="col-span-12 lg:col-span-8 space-y-6">
<!-- Step 1: Header (Compact/Read-only representation as we move to Step 2) -->
<div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
<div class="flex justify-between items-center mb-4">
<h4 class="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
<span class="material-symbols-outlined text-secondary" data-icon="description">description</span>
                            1. Dados da Nota
                        </h4>
<button class="text-secondary text-xs font-bold hover:underline">Alterar</button>
</div>
<div class="grid grid-cols-3 gap-6">
<div>
<p class="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Loja</p>
<p class="text-sm font-medium text-primary">Lamego Deli - Matriz</p>
</div>
<div>
<p class="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Fornecedor</p>
<p class="text-sm font-medium text-primary">Laticínios Minas Gerais Ltda.</p>
</div>
<div>
<p class="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Data da Compra</p>
<p class="text-sm font-medium text-primary">24 de Maio, 2024</p>
</div>
</div>
</div>
<!-- Step 2: Itens -->
<div class="bg-surface-container-lowest rounded-xl p-8 shadow-[0_12px_40px_rgba(61,10,10,0.06)] border border-outline-variant/10">
<div class="flex justify-between items-end mb-8">
<div>
<h4 class="text-xl font-bold text-primary mb-1">Adicionar Itens ao Pedido</h4>
<p class="text-sm text-on-surface-variant">Insira os produtos conforme constam na nota fiscal.</p>
</div>
<button class="bg-[#C0392B] text-white px-6 py-3 rounded-lg flex items-center gap-2 font-bold shadow-lg hover:opacity-90 transition-all active:scale-95">
<span class="material-symbols-outlined" data-icon="add">add</span>
                            Adicionar Item
                        </button>
</div>
<!-- Input Row -->
<div class="grid grid-cols-12 gap-4 mb-10 p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
<div class="col-span-5">
<label class="block text-[11px] font-bold text-primary uppercase mb-2">Produto</label>
<div class="relative">
<input class="w-full bg-white border-none rounded-lg py-3 px-4 text-sm ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-secondary focus:bg-white transition-all outline-none" placeholder="Pesquisar catálogo..." type="text"/>
<span class="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant opacity-40" data-icon="search">search</span>
</div>
</div>
<div class="col-span-2">
<label class="block text-[11px] font-bold text-primary uppercase mb-2">Qtd</label>
<input class="w-full bg-white border-none rounded-lg py-3 px-4 text-sm ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-secondary outline-none" type="number" value="1"/>
</div>
<div class="col-span-2">
<label class="block text-[11px] font-bold text-primary uppercase mb-2">Unidade</label>
<select class="w-full bg-white border-none rounded-lg py-3 px-4 text-sm ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-secondary outline-none appearance-none">
<option>kg</option>
<option>un</option>
<option>cx</option>
<option>lt</option>
</select>
</div>
<div class="col-span-3">
<label class="block text-[11px] font-bold text-primary uppercase mb-2">Preço Unitário</label>
<div class="relative">
<span class="absolute left-4 top-3.5 text-xs font-bold text-on-surface-variant">R$</span>
<input class="w-full bg-white border-none rounded-lg py-3 pl-10 pr-4 text-sm ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-secondary outline-none currency" placeholder="0,00" type="text"/>
</div>
</div>
</div>
<!-- Table -->
<div class="overflow-x-auto">
<table class="w-full text-left">
<thead>
<tr class="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/20">
<th class="pb-4 px-2">Item</th>
<th class="pb-4 px-2">Quantidade</th>
<th class="pb-4 px-2">Preço Unit.</th>
<th class="pb-4 px-2 text-right">Subtotal</th>
<th class="pb-4 px-2"></th>
</tr>
</thead>
<tbody class="divide-y divide-outline-variant/10">
<tr class="group hover:bg-surface-container-low/50 transition-colors">
<td class="py-5 px-2">
<p class="text-sm font-bold text-primary">Queijo Parmesão Curado</p>
<p class="text-[10px] text-on-surface-variant">SKU: 99821-MIN</p>
</td>
<td class="py-5 px-2">
<span class="text-sm font-medium">12.5 kg</span>
</td>
<td class="py-5 px-2">
<span class="currency text-sm">R$ 84,90</span>
</td>
<td class="py-5 px-2 text-right">
<span class="currency text-sm font-bold">R$ 1.061,25</span>
</td>
<td class="py-5 px-2 text-right">
<button class="text-on-surface-variant/40 hover:text-error transition-colors">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</td>
</tr>
<tr class="group hover:bg-surface-container-low/50 transition-colors">
<td class="py-5 px-2">
<p class="text-sm font-bold text-primary">Manteiga Artesanal com Sal</p>
<p class="text-[10px] text-on-surface-variant">SKU: 44102-ART</p>
</td>
<td class="py-5 px-2">
<span class="text-sm font-medium">20 un</span>
</td>
<td class="py-5 px-2">
<span class="currency text-sm">R$ 18,50</span>
</td>
<td class="py-5 px-2 text-right">
<span class="currency text-sm font-bold">R$ 370,00</span>
</td>
<td class="py-5 px-2 text-right">
<button class="text-on-surface-variant/40 hover:text-error transition-colors">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</td>
</tr>
</tbody>
</table>
</div>
</div>
<!-- Step 3 Preview: Drag and Drop -->
<div class="bg-surface-container-lowest rounded-xl p-8 shadow-sm border border-dashed border-outline-variant/50 flex flex-col items-center justify-center py-12">
<div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4 text-on-surface-variant/40">
<span class="material-symbols-outlined text-4xl" data-icon="cloud_upload">cloud_upload</span>
</div>
<h5 class="text-lg font-bold text-primary mb-1">Upload da Nota Fiscal</h5>
<p class="text-sm text-on-surface-variant mb-6">Arraste o arquivo ou clique para selecionar (PDF, JPG ou PNG)</p>
<button class="px-6 py-2 border-2 border-outline-variant/30 rounded-lg text-sm font-bold text-primary hover:bg-surface-container-low transition-colors">Selecionar Arquivo</button>
</div>
</div>
<!-- Summary Sidebar (Sticky) -->
<div class="col-span-12 lg:col-span-4">
<div class="sticky top-24 space-y-6">
<!-- Summary Card -->
<div class="bg-primary rounded-xl p-8 text-white shadow-2xl relative overflow-hidden">
<!-- Decorative background texture -->
<div class="absolute inset-0 opacity-10 pointer-events-none">
<div class="w-full h-full" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDCAMqMsFO0YCxj0J3rMCbO9fyEfMO2ZowPzAy1Q76z5d3dzuRvzKkH4xJznRAsXc4zh04NDCIHloW_nlRB2SRAeaifpFBVuVthdDFTI8z47AJxhmBHlVebwv88Hm0RbNxl9nup2ZmFnsta71vHtNAxPu2JUg-TyoVvj7VxuFa7mubV3s8EHcHkqm6h9h-bNjcYFy8WToMGB6jJsdh_kgkjQX09kMCnY1dKI9WY3OpAwHD2PRHtd7zR6wY_E-wEFIsZEopqKdymTzc5')"></div>
</div>
<div class="relative z-10">
<h4 class="text-[10px] font-bold uppercase tracking-[0.2em] mb-6 text-white/60">Resumo do Lançamento</h4>
<div class="space-y-4 mb-8">
<div class="flex justify-between items-center border-b border-white/10 pb-4">
<span class="text-sm text-white/70">Itens adicionados</span>
<span class="text-sm font-bold">02</span>
</div>
<div class="flex justify-between items-center border-b border-white/10 pb-4">
<span class="text-sm text-white/70">Subtotal</span>
<span class="currency text-sm">R$ 1.431,25</span>
</div>
<div class="flex justify-between items-center">
<span class="text-sm text-white/70">Impostos previstos</span>
<span class="currency text-sm">R$ 0,00</span>
</div>
</div>
<div class="mb-10">
<p class="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 text-white/60">Total Geral</p>
<p class="text-4xl font-bold currency tracking-tighter text-tertiary-fixed">R$ 1.431,25</p>
</div>
<div class="space-y-3">
<button class="w-full bg-[#C0392B] text-white py-4 rounded-lg font-extrabold text-sm uppercase tracking-wider shadow-xl hover:bg-red-700 transition-all active:scale-[0.98]">
                                    Próximo Passo
                                </button>
<button class="w-full bg-white/5 text-white/80 py-4 rounded-lg font-bold text-sm hover:bg-white/10 transition-all">
                                    Salvar Rascunho
                                </button>
</div>
</div>
</div>
<!-- Supplier Insight Card -->
<div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
<div class="flex items-center gap-4 mb-4">
<div class="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
<span class="material-symbols-outlined text-2xl" data-icon="local_shipping">local_shipping</span>
</div>
<div>
<h5 class="text-sm font-bold text-primary">Histórico Fornecedor</h5>
<p class="text-[11px] text-on-surface-variant">Laticínios Minas Gerais</p>
</div>
</div>
<p class="text-xs text-on-surface-variant leading-relaxed mb-4">
                            Última compra realizada há <span class="font-bold text-primary">12 dias</span>. O preço do Parmesão subiu <span class="text-error font-bold">3.2%</span> em relação ao mês anterior.
                        </p>
<div class="w-full h-1 bg-surface-container-low rounded-full overflow-hidden">
<div class="w-3/4 h-full bg-tertiary-fixed-dim"></div>
</div>
<div class="flex justify-between mt-2">
<span class="text-[10px] font-bold text-on-surface-variant uppercase">Confiabilidade</span>
<span class="text-[10px] font-bold text-primary uppercase">Frequente</span>
</div>
</div>
</div>
</div>
</div>
</main>
</body></html>


<!DOCTYPE html>

<html class="light" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Biblioteca de Componentes | Lamego Deli</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Public+Sans:wght@300;400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "secondary-fixed": "#ffdad5",
                        "primary-fixed": "#ffdad7",
                        "secondary-fixed-dim": "#ffb4a9",
                        "on-tertiary-fixed-variant": "#614000",
                        "secondary": "#b02d21",
                        "inverse-surface": "#2f3131",
                        "surface-container-lowest": "#ffffff",
                        "surface-dim": "#dadada",
                        "surface-tint": "#904a46",
                        "error-container": "#ffdad6",
                        "on-error-container": "#93000a",
                        "tertiary-fixed-dim": "#ffba44",
                        "surface-container-low": "#f3f3f3",
                        "surface-container-highest": "#e2e2e2",
                        "outline": "#867371",
                        "on-primary-container": "#be6f6a",
                        "error": "#ba1a1a",
                        "on-error-container": "#93000a",
                        "tertiary": "#050200",
                        "tertiary-fixed": "#ffddaf",
                        "on-primary-fixed": "#3b0809",
                        "inverse-on-surface": "#f1f1f1",
                        "on-secondary-container": "#650001",
                        "surface-container": "#eeeeee",
                        "surface-bright": "#f9f9f9",
                        "on-secondary-fixed": "#410000",
                        "surface-container-high": "#e8e8e8",
                        "on-surface-variant": "#534341",
                        "on-tertiary": "#ffffff",
                        "on-tertiary-fixed": "#281800",
                        "inverse-primary": "#ffb3ad",
                        "surface-variant": "#e2e2e2",
                        "secondary-container": "#fc6451",
                        "surface": "#f9f9f9",
                        "tertiary-container": "#2a1a00",
                        "background": "#f9f9f9",
                        "on-secondary-fixed-variant": "#8e130c",
                        "on-error": "#ffffff",
                        "on-surface": "#1a1c1c",
                        "on-primary": "#ffffff",
                        "outline-variant": "#d9c1bf",
                        "primary": "#0d0000",
                        "on-secondary": "#ffffff",
                        "primary-fixed-dim": "#ffb3ad",
                        "primary-container": "#3d0a0a",
                        "on-background": "#1a1c1c",
                        "on-primary-fixed-variant": "#733330"
                    },
                    fontFamily: {
                        "headline": ["Inter"],
                        "body": ["Public Sans"],
                        "label": ["Space Grotesk"]
                    },
                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            line-height: 1;
            text-transform: none;
            letter-spacing: normal;
            word-wrap: normal;
            white-space: nowrap;
            direction: ltr;
        }
        body { font-family: 'Public Sans', sans-serif; }
        .font-headline { font-family: 'Inter', sans-serif; }
        .font-label { font-family: 'Space Grotesk', sans-serif; }
    </style>
</head>
<body class="bg-surface-container-low text-on-surface">
<!-- SideNavBar Anchor -->
<aside class="h-screen w-[240px] fixed left-0 top-0 flex flex-col bg-[#3D0A0A] dark:bg-slate-950 border-r border-white/10 shadow-2xl font-['Inter'] antialiased text-sm tracking-tight py-6">
<div class="px-6 mb-8">
<h1 class="text-xl font-bold tracking-tighter text-white uppercase">Lamego Deli</h1>
<p class="text-white/50 text-xs">Est. 1998</p>
</div>
<nav class="flex-1 flex flex-col gap-1">
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">dashboard</span>
                Visão Geral
            </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">add_shopping_cart</span>
                Lançar Compra
            </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">history</span>
                Histórico
            </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">notifications_active</span>
                Alertas
            </a>
<a class="bg-[#C0392B] text-white rounded-md mx-2 flex items-center gap-3 px-4 py-3 font-semibold transition-all scale-100 active:scale-95" href="#">
<span class="material-symbols-outlined">menu_book</span>
                Catálogo
            </a>
</nav>
<div class="mt-auto border-t border-white/10 pt-4">
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">settings</span>
                Configurações
            </a>
<a class="text-white/70 hover:text-white flex items-center gap-3 px-4 py-3 mx-2 transition-colors hover:bg-white/5" href="#">
<span class="material-symbols-outlined">logout</span>
                Sair
            </a>
</div>
</aside>
<!-- TopNavBar Anchor -->
<header class="fixed top-0 right-0 left-[240px] h-16 flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm z-40">
<div class="flex justify-between items-center w-full px-8">
<div class="flex items-center gap-4">
<h2 class="text-lg font-bold text-[#3D0A0A] dark:text-white font-headline">Catálogo / Design System</h2>
</div>
<div class="flex items-center gap-6">
<div class="relative">
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-[#C0392B] transition-colors">notifications</span>
<span class="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full"></span>
</div>
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-[#C0392B] transition-colors">storefront</span>
<div class="w-8 h-8 rounded-full overflow-hidden border-2 border-primary-container">
<img alt="Avatar do Gerente" class="w-full h-full object-cover" data-alt="professional headshot of a middle aged man with glasses and a friendly smile in a bakery environment" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8Sjn_8YGzy9WYd7rMfH2jifJfSInxwP5-ColdSMfEXOhIuVQyehsZZU5blMP0csA1rvbKHMUqfai9ZU8Gdg1P52I5qgXUwDAXckTGmChRX5m_f0q4QfTGzeW5G-fLqdvFAntbfT1H-ovXZnLIJykI-Fgqk1U26UaCldicbiFBXSAlsePSoE9Gc9btQRLHd0Em7igEHOLwJz0ZpWp8kCsjtKb7N19xvGGVzt7s8EzGEfEqAZTzsk4xLMneUiyrhMgwSHrdY3GYje9e"/>
</div>
</div>
</div>
</header>
<!-- Main Content Canvas -->
<main class="ml-[240px] pt-24 pb-12 px-12 max-w-7xl">
<!-- Header Section -->
<section class="mb-16">
<h1 class="text-6xl font-headline font-bold text-primary-container tracking-tighter mb-4">Design System</h1>
<p class="text-on-surface-variant max-w-2xl text-lg">
                O Modern Artisanal Curator: Uma biblioteca de componentes focada na excelência editorial para o gerenciamento da Lamego Deli &amp; Delícias.
            </p>
</section>
<!-- Atoms Section -->
<section class="mb-20">
<div class="flex items-center gap-4 mb-8">
<span class="h-px flex-1 bg-outline-variant/30"></span>
<h2 class="text-2xl font-headline font-bold text-primary-container uppercase tracking-widest">Átomos</h2>
<span class="h-px flex-1 bg-outline-variant/30"></span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-12">
<!-- Buttons -->
<div class="space-y-6">
<h3 class="text-sm font-bold text-on-surface-variant uppercase tracking-tighter">Botões (Botões)</h3>
<div class="flex flex-wrap gap-4 items-center">
<button class="px-6 py-2.5 bg-primary-container text-white rounded-xl font-medium shadow-[0_4px_12px_rgba(61,10,10,0.15)] hover:opacity-90 transition-all active:scale-95">Principal</button>
<button class="px-6 py-2.5 border border-primary-container text-primary-container rounded-xl font-medium hover:bg-primary-container hover:text-white transition-all">Contorno</button>
<button class="px-6 py-2.5 text-primary-container font-medium hover:bg-surface-container transition-all">Fantasma</button>
<button class="px-6 py-2.5 bg-secondary text-white rounded-xl font-medium hover:bg-on-secondary-fixed-variant transition-all">Perigo</button>
<button class="px-6 py-2.5 bg-surface-container-highest text-on-surface-variant rounded-xl font-medium cursor-not-allowed opacity-50" disabled="">Desativado</button>
</div>
</div>
<!-- Inputs -->
<div class="space-y-6">
<h3 class="text-sm font-bold text-on-surface-variant uppercase tracking-tighter">Campos de Entrada</h3>
<div class="grid grid-cols-1 gap-4">
<input class="w-full px-4 py-3 bg-surface-container rounded-xl border-none focus:ring-2 focus:ring-secondary-fixed focus:bg-surface-container-lowest transition-all" placeholder="Padrão" type="text"/>
<input class="w-full px-4 py-3 bg-surface-container-lowest rounded-xl border-none ring-2 ring-secondary-fixed shadow-sm" placeholder="Focado" type="text"/>
<div class="space-y-1">
<input class="w-full px-4 py-3 bg-surface-container rounded-xl border border-error focus:ring-error transition-all" type="text" value="Valor incorreto"/>
<span class="text-xs text-error font-medium">Este campo é obrigatório.</span>
</div>
</div>
</div>
<!-- Badges & Avatars -->
<div class="space-y-6">
<h3 class="text-sm font-bold text-on-surface-variant uppercase tracking-tighter">Badges e Avatares</h3>
<div class="flex flex-wrap gap-6 items-center">
<div class="flex gap-2">
<span class="px-3 py-1 bg-tertiary-fixed text-on-tertiary-container text-xs font-bold rounded-full">SUCESSO</span>
<span class="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed-variant text-xs font-bold rounded-full">ALERTA</span>
<span class="px-3 py-1 bg-error-container text-on-error-container text-xs font-bold rounded-full">ERRO</span>
</div>
<div class="flex -space-x-3">
<img class="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover" data-alt="close up of a cheerful young man's face" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5m3rTWKFNZWnvS_LgjMtrKkmjmaucnqxFB97PdWf61QkbkfIZ7tnLtNTAFq2S3_lXQOMzqPUrfeLFgvAGhTHEGojyjCqZMYj8YpnwOOmNeRPF1zlZMkLIU0aoXo0qScDcABrs_bbDOY5nfEFmJ9Go0_tJk_6fClGdBQi-4ov2jzXdWh-C8gOpHgXzJ4HRW3qStAoNX0Ro_OuivhqqtgsQThGqTwoCoQ_d3AEhoc0K0lBRgxkoy1lZv5n2Y7j7IIGKz_S26lyQlA17"/>
<img class="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover" data-alt="close up of a smiling woman with glasses" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBc-a_lbzFm3Wg5AdNKee58yMlD90yS1DEKwVqENqlUc3ux4bppnXGe4EDqw7qUvUkceJw9Izge_WLeN5bwRqWZuA7XO2-E0BbK8BhQqKpgybrswy7yofTsYXHPsDRO_DJjaq2AWgaELlaXhm34LDvYoF0L1MqmKzjBB_ODFnQKFXgbjVilCayk6R4H1506slbpm8Gbp7pjRLoKFhYC7qDLVMdgqyc8FqtqV9U-1yOIYPRYtokOqGLaN5oO-y14OYY4ttPTFd5Wpt8T"/>
<div class="w-10 h-10 rounded-full border-2 border-surface-container-lowest bg-primary-container flex items-center justify-center text-[10px] text-white font-bold">+12</div>
</div>
</div>
</div>
<!-- Spinners -->
<div class="space-y-6">
<h3 class="text-sm font-bold text-on-surface-variant uppercase tracking-tighter">Indicadores de Carga</h3>
<div class="flex gap-8 items-center">
<div class="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
<div class="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
<div class="flex gap-1">
<div class="w-2 h-2 bg-primary-container rounded-full animate-bounce"></div>
<div class="w-2 h-2 bg-primary-container rounded-full animate-bounce [animation-delay:-0.15s]"></div>
<div class="w-2 h-2 bg-primary-container rounded-full animate-bounce [animation-delay:-0.3s]"></div>
</div>
</div>
</div>
</div>
</section>
<!-- Molecules Section -->
<section class="mb-20">
<div class="flex items-center gap-4 mb-8">
<span class="h-px flex-1 bg-outline-variant/30"></span>
<h2 class="text-2xl font-headline font-bold text-primary-container uppercase tracking-widest">Moléculas</h2>
<span class="h-px flex-1 bg-outline-variant/30"></span>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
<!-- KPI Card -->
<div class="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_12px_40px_rgba(61,10,10,0.06)] border border-outline-variant/10">
<div class="flex justify-between items-start mb-4">
<div class="p-2 bg-primary-fixed rounded-lg">
<span class="material-symbols-outlined text-primary-container">payments</span>
</div>
<span class="text-tertiary-container font-bold text-xs">+12.5%</span>
</div>
<p class="text-on-surface-variant text-sm font-medium">Total em Compras</p>
<h4 class="text-3xl font-label font-bold text-primary-container mt-1">R$ 42.850,00</h4>
</div>
<!-- Alert Card -->
<div class="bg-secondary-fixed/30 p-6 rounded-2xl border-l-4 border-secondary flex gap-4">
<span class="material-symbols-outlined text-secondary">warning</span>
<div>
<h4 class="font-bold text-on-secondary-fixed">Estoque Crítico</h4>
<p class="text-sm text-on-secondary-fixed-variant">Farinha de Trigo Tipo 1 está abaixo de 5kg.</p>
</div>
</div>
<!-- Progress Indicator -->
<div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 flex flex-col justify-center">
<div class="flex justify-between items-end mb-2">
<span class="text-sm font-bold text-primary-container uppercase">Meta Mensal</span>
<span class="text-xs font-label text-on-surface-variant">78%</span>
</div>
<div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
<div class="h-full bg-tertiary-fixed-dim rounded-full" style="width: 78%"></div>
</div>
</div>
<!-- File Upload Zone -->
<div class="md:col-span-2 bg-surface-container-low border-2 border-dashed border-outline-variant rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-surface-container transition-colors cursor-pointer group">
<div class="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-primary-container">cloud_upload</span>
</div>
<div class="text-center">
<p class="font-bold text-primary-container">Clique para enviar NF-e</p>
<p class="text-xs text-on-surface-variant">ou arraste e solte o arquivo XML (Máx 5MB)</p>
</div>
</div>
<!-- Searchable Select -->
<div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
<label class="text-xs font-bold text-on-surface-variant uppercase mb-2 block">Fornecedor</label>
<div class="relative">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
<input class="w-full pl-10 pr-4 py-2 bg-surface-container rounded-lg border-none focus:ring-1 focus:ring-primary-container text-sm" placeholder="Buscar fornecedor..." type="text"/>
</div>
</div>
</div>
</section>
<!-- Organisms Section -->
<section class="mb-20">
<div class="flex items-center gap-4 mb-8">
<span class="h-px flex-1 bg-outline-variant/30"></span>
<h2 class="text-2xl font-headline font-bold text-primary-container uppercase tracking-widest">Organismos</h2>
<span class="h-px flex-1 bg-outline-variant/30"></span>
</div>
<!-- Data Table -->
<div class="mb-12 bg-surface-container-lowest rounded-3xl shadow-[0_12px_40px_rgba(61,10,10,0.06)] overflow-hidden border border-outline-variant/10">
<div class="p-6 border-b border-surface-container-low flex justify-between items-center">
<h3 class="font-bold text-primary-container">Últimas Compras</h3>
<button class="text-sm font-bold text-[#C0392B] flex items-center gap-1 hover:underline">
                        Ver histórico completo <span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
<table class="w-full text-left">
<thead class="bg-surface-container-low/50">
<tr>
<th class="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Item</th>
<th class="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Data</th>
<th class="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Fornecedor</th>
<th class="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Valor</th>
<th class="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Status</th>
</tr>
</thead>
<tbody class="divide-y divide-surface-container-low">
<tr class="hover:bg-surface-bright transition-colors">
<td class="px-6 py-5 font-bold text-primary-container">Manteiga Artesanal 5kg</td>
<td class="px-6 py-5 text-sm text-on-surface-variant">12 Out, 2023</td>
<td class="px-6 py-5 text-sm text-on-surface-variant">Laticínios Minas</td>
<td class="px-6 py-5 font-label text-right font-bold">R$ 450,00</td>
<td class="px-6 py-5 text-center">
<span class="px-3 py-1 bg-tertiary-fixed text-on-tertiary-container text-[10px] font-bold rounded-full">ENTREGUE</span>
</td>
</tr>
<!-- Skeleton State -->
<tr class="animate-pulse">
<td class="px-6 py-5"><div class="h-4 w-32 bg-surface-container rounded"></div></td>
<td class="px-6 py-5"><div class="h-4 w-20 bg-surface-container rounded"></div></td>
<td class="px-6 py-5"><div class="h-4 w-24 bg-surface-container rounded"></div></td>
<td class="px-6 py-5"><div class="h-4 w-16 bg-surface-container rounded ml-auto"></div></td>
<td class="px-6 py-5 flex justify-center"><div class="h-6 w-16 bg-surface-container rounded-full"></div></td>
</tr>
</tbody>
</table>
</div>
<div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
<!-- Modal Example (Static) -->
<div class="bg-black/5 rounded-3xl p-12 flex items-center justify-center border border-outline-variant/20">
<div class="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
<div class="p-6 border-b border-surface-container">
<h4 class="text-xl font-bold text-primary-container">Confirmar Exclusão</h4>
</div>
<div class="p-6">
<p class="text-on-surface-variant">Tem certeza que deseja excluir este registro de compra? Esta ação não pode ser desfeita.</p>
</div>
<div class="p-6 bg-surface-container-low flex justify-end gap-3">
<button class="px-4 py-2 font-bold text-on-surface-variant">Cancelar</button>
<button class="px-6 py-2 bg-secondary text-white rounded-lg font-bold">Excluir Agora</button>
</div>
</div>
</div>
<!-- Toast Notifications Cluster -->
<div class="space-y-4">
<div class="flex items-center gap-4 bg-primary-container text-white p-4 rounded-xl shadow-lg w-full max-w-sm">
<span class="material-symbols-outlined text