package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	err := wails.Run(&options.App{
		Title:            "FinEx — подготовка к экзамену квалифицированного инвестора",
		Width:            1320,
		Height:           860,
		MinWidth:         420,
		MinHeight:        560,
		BackgroundColour: &options.RGBA{R: 14, G: 19, B: 24, A: 255},
		WindowStartState: options.Maximised,
		AssetServer:      &assetserver.Options{Assets: assets},
		Windows: &windows.Options{
			WebviewUserDataPath: "",
			Theme:               windows.Dark,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
