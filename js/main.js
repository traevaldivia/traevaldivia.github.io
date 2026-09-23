// Utilidades compartidas del sitio: registro, página actual, menú móvil y año
// del pie.
(function () {
    'use strict';

    // Registro que solo habla en desarrollo. Nunca imprimir datos de pacientes:
    // el nombre, el comentario y el telefono del formulario no pasan por aqui.
    var enLocal = ['localhost', '127.0.0.1', '::1'].indexOf(location.hostname) !== -1;
    window.creaLog = function () {
        if (!enLocal) return;
        console.log.apply(console, ['[crea]'].concat(Array.prototype.slice.call(arguments)));
    };

    // La página actual con un solo formato para GA4 y para la hoja de
    // contactos: sin barra inicial y con index.html explícito
    // ('/' -> 'index.html', '/blog/' -> 'blog/index.html').
    window.creaPagina = function () {
        var ruta = location.pathname.replace(/\/$/, '/index.html').replace(/^\//, '');
        return ruta || 'index.html';
    };

    function menuMovil() {
        var boton = document.getElementById('menu-boton');
        var menu = document.getElementById('menu-principal');
        if (!boton || !menu) return;

        var cabecera = boton.closest('.cabecera') || document.body;

        // El nombre fijo («Menú») lo pone el HTML y aquí solo cambia
        // aria-expanded: si el nombre dijera «Abrir» con el menú ya abierto,
        // el lector anunciaría una contradicción.
        function abierto() { return boton.getAttribute('aria-expanded') === 'true'; }

        function cerrar(devolverFoco) {
            boton.setAttribute('aria-expanded', 'false');
            cabecera.classList.remove('cabecera--menu-abierto');
            document.body.classList.remove('sin-scroll');
            if (devolverFoco) boton.focus();
        }

        function abrir() {
            boton.setAttribute('aria-expanded', 'true');
            cabecera.classList.add('cabecera--menu-abierto');
            document.body.classList.add('sin-scroll');
            var primero = menu.querySelector('a, button');
            if (primero) primero.focus();
        }

        boton.addEventListener('click', function () {
            if (abierto()) cerrar(false); else abrir();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && abierto()) cerrar(true);
        });

        // Un clic fuera del menu abierto lo cierra
        document.addEventListener('click', function (e) {
            if (!abierto()) return;
            if (menu.contains(e.target) || boton.contains(e.target)) return;
            cerrar(false);
        });

        // Navegar a una seccion de la misma pagina cierra el menu
        menu.addEventListener('click', function (e) {
            if (e.target.closest('a') && abierto()) cerrar(false);
        });

        // Al pasar a escritorio el menú deja de estar desplegado: se limpia el
        // estado para que no quede el scroll bloqueado. Tiene que ser el mismo
        // corte que el @media de .menu en style.css (62rem).
        var anchoEscritorio = window.matchMedia('(min-width: 62rem)');
        var alCambiar = function (e) { if (e.matches && abierto()) cerrar(false); };
        if (anchoEscritorio.addEventListener) anchoEscritorio.addEventListener('change', alCambiar);
    }

    function anoActual() {
        document.querySelectorAll('[data-ano]').forEach(function (el) {
            el.textContent = String(new Date().getFullYear());
        });
    }

    function iniciar() {
        menuMovil();
        anoActual();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
