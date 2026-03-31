# Comics Scraper

This tool use Firefox to extract comics from website [readcomiconline.li](https://readcomiconline.li).

## Setup

1. Set up a list of file in a JSON file, for example:
    ```json
    [
      "https://readcomiconline.line.li/<COMIC_URL>"
    ]
    ```
   You can save the file as `inputs.json` in the same directory as the script.
2. Go to Firefox folder and start it with remote debugging enabled using the following command in the terminal:
   ```powershell
    .\firefox.exe --remote-debugging-port 9222
   ```
   Adjust the command for your operating system if you're not using Windows.
3. Open `about:config` in Firefox and set the following preferences:
    - `fission.webContentIsolationStrategy` to `0`

## Usage

For standard usage, run the script with the following command:

```powershell
npm run dev
```

If you want to specify a custom input file, use the following command:

```powershell
npm run dev -- path/to/your/input.json
```