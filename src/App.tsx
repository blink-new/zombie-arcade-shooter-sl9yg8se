import { useState } from 'react'
import ZombieGame from './components/ZombieGame'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'

function App() {
  const [gameStarted, setGameStarted] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-purple-900 text-white overflow-hidden">
      {!gameStarted ? (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md bg-black/50 border-red-500/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-bold text-red-400 mb-2">
                🧟 ZOMBIE ARCADE
              </CardTitle>
              <CardDescription className="text-lg text-gray-300">
                Dead Ops Style Survival Shooter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-3">
                <p className="text-gray-300">
                  Survive endless waves of zombies in this top-down arcade shooter!
                </p>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>🎮 <strong>WASD</strong> - Move</p>
                  <p>🎯 <strong>Mouse</strong> - Aim & Shoot</p>
                  <p>🔥 <strong>Survive</strong> - As long as you can!</p>
                </div>
              </div>
              <Button 
                onClick={() => setGameStarted(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-lg"
              >
                START GAME
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ZombieGame onGameOver={() => setGameStarted(false)} />
      )}
    </div>
  )
}

export default App