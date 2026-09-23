// Tema oscuro (por defecto) / claro, con data-theme en <html>.
//
// El tema claro se declara con [data-theme="light"] y nunca con
// @media (prefers-color-scheme): asi la eleccion de la persona manda siempre
// sobre la del sistema.
(function () {
    'use strict';

    var CLAVE = 'crea-tema';
    // Igual al fondo de la cabecera en cada tema, para que la barra del
    // navegador movil no corte con un color ajeno.
    var COLORES = { light: '#FFFFFF', dark: '#0A1013' };
    var html = document.documentElement;

    function guardado() {
        try { return localStorage.getItem(CLAVE); } catch (e) { return null; }
    }

    function guardar(tema) {
        try { localStorage.setItem(CLAVE, tema); } catch (e) { /* sin almacenamiento */ }
    }

    // El sitio es oscuro por defecto: la escena real es un telefono de noche
    // despues de un dia con dolor. Solo se aclara si la persona lo pide.
    // Se aplica antes de pintar para que no haya destello.
    var inicial = guardado() === 'light' ? 'light' : 'dark';
    html.setAttribute('data-theme', inicial);

    function pintarColorDeBarra(tema) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = COLORES[tema];
    }

    // Botón de alternancia: el nombre fijo («Modo claro») lo pone el HTML y
    // aquí solo cambia el estado, en aria-pressed. Un nombre que cambiara
    // («Cambiar a modo oscuro») junto a aria-pressed haría que el lector
    // anunciara dos cosas opuestas.
    function etiquetar(boton, tema) {
        boton.setAttribute('aria-pressed', tema === 'light' ? 'true' : 'false');
    }

    function iniciar() {
        var boton = document.getElementById('cambiar-tema');
        pintarColorDeBarra(html.getAttribute('data-theme'));
        if (!boton) return;

        etiquetar(boton, html.getAttribute('data-theme'));

        // Es un <button> nativo: Enter y Espacio ya disparan click, no hace
        // falta escuchar el teclado ni fingir role/tabindex.
        boton.addEventListener('click', function () {
            var nuevo = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            html.setAttribute('data-theme', nuevo);
            guardar(nuevo);
            pintarColorDeBarra(nuevo);
            etiquetar(boton, nuevo);
            if (window.gtag) {
                window.gtag('event', 'cambio_tema', { tema: nuevo });
            }
        });

        // Otra pestana cambio el tema
        window.addEventListener('storage', function (e) {
            if (e.key !== CLAVE || !e.newValue) return;
            html.setAttribute('data-theme', e.newValue);
            pintarColorDeBarra(e.newValue);
            etiquetar(boton, e.newValue);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
