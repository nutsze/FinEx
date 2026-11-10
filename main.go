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
		BackgroundColour: &options.RGBA{R: 238, G: 241, B: 244, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		Windows: &windows.Options{
			WebviewUserDataPath: "",
			Theme:               windows.SystemDefault,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
