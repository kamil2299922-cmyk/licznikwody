# 💧 Rozkład zużycia wody

Prosta aplikacja webowa, która rozpisuje zużycie wody z maksymalnie 4 liczników na poszczególne dni okresu między dwoma odczytami. Działa w całości w przeglądarce (bez serwera, bez wysyłania danych), na komputerach, tabletach i telefonach.

## Jak działa

- **Dane wejściowe:** data ostatniego odczytu, data najnowszego odczytu oraz dla każdego licznika: nazwa, stan początkowy, stan końcowy i opcjonalnie maksymalne dzienne zużycie.
- **Okres:** zużycie rozkładane jest na dni od dnia po ostatnim odczycie do dnia najnowszego odczytu włącznie.
- **Weekendy i święta:** zużycie jest losowo o 20–30% większe niż w dni robocze. Uwzględniane są polskie święta ustawowo wolne (w tym ruchome: Wielkanoc, Zielone Świątki, Boże Ciało oraz Wigilia od 2025 r.).
- **Naturalny wygląd:** każdy dzień ma lekkie wahania (±5%). Przycisk „Losuj ponownie” generuje inny wariant.
- **Dokładność:** rozkład liczony jest z dokładnością do 0,01 m³, a w raporcie stany liczników są zaokrąglane do pełnych m³. Zużycie dzienne to różnica zaokrąglonych stanów, więc tabela zawsze się sumuje (małe zużycie, np. 1 m³ na kilka tygodni, pojawia się naturalnie w jednym dniu).
- **Limit dzienny:** podawany w pełnych m³, nigdy nie jest przekroczony. W zwykłe dni obowiązuje limit obniżony o 1–3% (przy małych limitach o 1 m³), a pełna wartość limitu pojawia się sporadycznie – ok. raz na 30 dni, chyba że wymaga tego wysokie zużycie. Jeśli zużycia nie da się zmieścić w limicie, aplikacja pokazuje komunikat.
- **Raport:** tabela ze stanem licznika na każdy dzień (pogrubiony) i zużyciem obok. Wydruk zawiera samą tabelę, A4 w poziomie (w oknie drukowania wybierz „Zapisz jako PDF”).
- Wpisane dane są zapamiętywane w przeglądarce (localStorage).

## Publikacja na GitHub Pages

1. Utwórz nowe repozytorium na GitHubie (np. `rozklad-wody`).
2. Wgraj do niego pliki `index.html`, `style.css`, `app.js`, `README.md` (przez „Add file → Upload files” albo `git push`).
3. Wejdź w **Settings → Pages**, w sekcji *Build and deployment* wybierz **Deploy from a branch**, gałąź `main`, folder `/ (root)` i zapisz.
4. Po chwili aplikacja będzie dostępna pod adresem `https://<twoja-nazwa>.github.io/rozklad-wody/`.

## Uruchomienie lokalne

Wystarczy otworzyć plik `index.html` w przeglądarce.

## Pliki

| Plik | Opis |
|------|------|
| `index.html` | struktura strony |
| `style.css` | wygląd, responsywność, styl wydruku |
| `app.js` | logika: święta, walidacja, algorytm rozkładu |
