// Aparicion progresiva al hacer scroll. Un solo sistema para todo el sitio:
// una animacion nueva extiende este archivo, no crea otro.
//
// Regla que no se rompe: el contenido es visible por defecto. El estado
// inicial oculto lo aplica este mismo JS (anade .anima-lista a <html>), asi
// que sin JS, con el JS caido o con prefers-reduced-motion, la pagina se lee
// completa. Solo se anima transform y opacity.
(function () {
    'use strict';

    var SELECTOR = '[data-anima]';

    function iniciar() {
        var elementos = document.querySelectorAll(SELECTOR);
        if (!elementos.length) return;

        var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (sinMovimiento || !('IntersectionObserver' in window)) return;

        document.documentElement.classList.add('anima-lista');

        var observador = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (entrada) {
                if (!entrada.isIntersecting) return;
                var el = entrada.target;
                // El retraso escalona los hijos de una misma rejilla sin
                // necesidad de escribirlo en el HTML de cada tarjeta.
                var retraso = Number(el.dataset.anima) || 0;
                el.style.transitionDelay = retraso + 'ms';
                el.classList.add('visible');
                observador.unobserve(el);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

        elementos.forEach(function (el) { observador.observe(el); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
