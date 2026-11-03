Set-Location "d:\Namith\HTML\Healthly"
Write-Host "Current location: $(Get-Location)"
Write-Host "Git status (first 5):"
git status --short | Select-Object -First 5
Write-Host ""
Write-Host "Adding all files..." -ForegroundColor Cyan
git add .
Write-Host "Committing..." -ForegroundColor Cyan
git commit -m 'Initial commit: mental-wellness-platform'
Write-Host ""
Write-Host "Checking commit:" -ForegroundColor Cyan
git log --oneline -1
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin master
Write-Host "Push completed"
