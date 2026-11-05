// The probe must measure the app's real stylesheet, tokens and all, and the
// app is dark-first — `index.html` ships `data-mantine-color-scheme="dark"` on
// <html>. Anything less and every contrast measurement in Module C is taken
// against the wrong palette.
import '../../src/App.css';

document.documentElement.dataset.mantineColorScheme = 'dark';
document.documentElement.style.colorScheme = 'dark';
