export interface ScriptTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  description: string;
  source: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export const SCRIPT_LANGUAGES = [
  'Lua', 'Python', 'JavaScript', 'TypeScript', 'C#', 'HTML/CSS', 'Rust', 'Go', 'Java', 'SQL'
];

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // BEGINNER LUA SCRIPTS
  {
    id: 'lua_hello_world',
    name: 'Hello World',
    language: 'Lua',
    category: 'Basics',
    description: 'Print a simple message to console',
    difficulty: 'beginner',
    tags: ['print', 'basics'],
    source: `-- Hello World Script
print("Hello from NexaVerse!")
print("This is a Lua script")
`,
  },
  {
    id: 'lua_timer',
    name: 'Simple Timer',
    language: 'Lua',
    category: 'Basics',
    description: 'Create a timer that counts down',
    difficulty: 'beginner',
    tags: ['timer', 'wait', 'loop'],
    source: `-- Countdown Timer
local countdown = 10
while countdown > 0 do
  print("Time remaining: " .. countdown .. "s")
  wait(1)
  countdown = countdown - 1
end
print("Time's up!")
`,
  },
  {
    id: 'lua_part_spawner',
    name: 'Spawn Parts',
    language: 'Lua',
    category: 'Physics',
    description: 'Spawn random colored parts',
    difficulty: 'beginner',
    tags: ['spawn', 'physics', 'parts'],
    source: `-- Spawn random colored parts
for i = 1, 5 do
  local part = Instance.new("Part")
  part.Name = "Part" .. i
  part.Position = Vector3.new(i * 4, 10, 0)
  part.Size = Vector3.new(2, 2, 2)

  local r = math.random()
  local g = math.random()
  local b = math.random()
  part.Color = Color3.new(r, g, b)

  print("Created part #" .. i)
  wait(0.5)
end
`,
  },
  {
    id: 'lua_key_detector',
    name: 'Key Press Detector',
    language: 'Lua',
    category: 'Input',
    description: 'Detect when a player presses a key',
    difficulty: 'beginner',
    tags: ['input', 'keyboard', 'events'],
    source: `-- Detect key presses
local player = game:GetService("PlayerService").LocalPlayer
if player then
  print("Player detected: " .. player.Name)
end

-- Listen for specific keys
task.spawn(function()
  while true do
    wait(0.1)
    print("Player is playing...")
  end
end)
`,
  },
  {
    id: 'lua_humanoid_health',
    name: 'Health System',
    language: 'Lua',
    category: 'Game Logic',
    description: 'Basic health and damage system',
    difficulty: 'beginner',
    tags: ['health', 'damage', 'humanoid'],
    source: `-- Simple Health System
local humanoid = script.Parent:FindFirstChildOfClass("Humanoid")
if humanoid then
  humanoid.MaxHealth = 100
  humanoid.Health = 100

  humanoid.HealthChanged:Connect(function(newHealth)
    print("Health: " .. newHealth .. " / " .. humanoid.MaxHealth)
    if newHealth <= 0 then
      print("Player died!")
    end
  end)

  humanoid.Died:Connect(function()
    print("Death event triggered")
  end)
end
`,
  },

  // INTERMEDIATE LUA SCRIPTS
  {
    id: 'lua_touch_damage',
    name: 'Touch Damage',
    language: 'Lua',
    category: 'Physics',
    description: 'Deal damage when player touches object',
    difficulty: 'intermediate',
    tags: ['collision', 'damage', 'touch'],
    source: `-- Deal damage on touch
local damageAmount = 25
local cooldown = 1
local lastDamageTime = 0

local part = script.Parent
part.Touched:Connect(function(hit)
  local humanoid = hit.Parent:FindFirstChildOfClass("Humanoid")
  if humanoid and tick() - lastDamageTime >= cooldown then
    humanoid:TakeDamage(damageAmount)
    lastDamageTime = tick()
    print("Dealt " .. damageAmount .. " damage!")
  end
end)
`,
  },
  {
    id: 'lua_patrol_ai',
    name: 'Patrol AI',
    language: 'Lua',
    category: 'AI',
    description: 'NPC that patrols between waypoints',
    difficulty: 'intermediate',
    tags: ['ai', 'npc', 'patrol'],
    source: `-- Simple Patrol AI
local waypoints = {
  Vector3.new(0, 1, 0),
  Vector3.new(10, 1, 0),
  Vector3.new(10, 1, 10),
  Vector3.new(0, 1, 10),
}

local character = script.Parent
local humanoid = character:FindFirstChildOfClass("Humanoid")
local speed = 16

while humanoid and humanoid.Health > 0 do
  for _, waypoint in ipairs(waypoints) do
    humanoid:MoveTo(waypoint)
    humanoid.MoveToFinished:Wait()
  end
end
`,
  },
  {
    id: 'lua_game_state',
    name: 'Game State Manager',
    language: 'Lua',
    category: 'Game Logic',
    description: 'Manage game states (lobby, playing, ended)',
    difficulty: 'intermediate',
    tags: ['state', 'game-management', 'events'],
    source: `-- Game State Manager
local gameState = {
  current = "lobby",
  players = {},
  maxPlayers = 10,
  roundTime = 300,
}

function gameState:setState(newState)
  print("State changed: " .. self.current .. " -> " .. newState)
  self.current = newState
end

function gameState:addPlayer(player)
  table.insert(self.players, player)
  print("Player joined. Count: " .. #self.players)
end

function gameState:startGame()
  if self.current == "lobby" and #self.players > 0 then
    self:setState("playing")
    wait(self.roundTime)
    self:setState("ended")
  end
end

-- Usage
gameState:addPlayer("Player1")
gameState:addPlayer("Player2")
gameState:startGame()
`,
  },
  {
    id: 'lua_inventory',
    name: 'Inventory System',
    language: 'Lua',
    category: 'Game Logic',
    description: 'Basic inventory management',
    difficulty: 'intermediate',
    tags: ['inventory', 'items', 'storage'],
    source: `-- Simple Inventory System
local Inventory = {}
Inventory.items = {}
Inventory.maxSize = 20

function Inventory:addItem(itemName, quantity)
  if #self.items < self.maxSize then
    table.insert(self.items, {name = itemName, qty = quantity or 1})
    print("Added " .. quantity .. " " .. itemName)
    return true
  end
  print("Inventory full!")
  return false
end

function Inventory:removeItem(itemName, quantity)
  for i, item in ipairs(self.items) do
    if item.name == itemName and item.qty >= quantity then
      item.qty = item.qty - quantity
      if item.qty <= 0 then
        table.remove(self.items, i)
      end
      return true
    end
  end
  return false
end

function Inventory:listItems()
  for _, item in ipairs(self.items) do
    print(item.name .. " x" .. item.qty)
  end
end

-- Usage
Inventory:addItem("Gold", 100)
Inventory:addItem("Sword", 1)
Inventory:listItems()
`,
  },
  {
    id: 'lua_leaderboard',
    name: 'Leaderboard System',
    language: 'Lua',
    category: 'Game Logic',
    description: 'Track and display player scores',
    difficulty: 'intermediate',
    tags: ['leaderboard', 'scoring', 'players'],
    source: `-- Leaderboard System
local Leaderboard = {}
Leaderboard.scores = {}

function Leaderboard:addScore(playerName, points)
  self.scores[playerName] = (self.scores[playerName] or 0) + points
  print(playerName .. " scored " .. points .. " points!")
end

function Leaderboard:getTop(count)
  local sorted = {}
  for name, score in pairs(self.scores) do
    table.insert(sorted, {name = name, score = score})
  end
  table.sort(sorted, function(a, b) return a.score > b.score end)
  return {table.unpack(sorted, 1, count)}
end

function Leaderboard:display()
  print("\\n=== LEADERBOARD ===")
  for i, entry in ipairs(self:getTop(10)) do
    print(i .. ". " .. entry.name .. " - " .. entry.score)
  end
  print("===================\\n")
end

-- Usage
Leaderboard:addScore("Alice", 100)
Leaderboard:addScore("Bob", 150)
Leaderboard:addScore("Charlie", 120)
Leaderboard:display()
`,
  },

  // ADVANCED LUA SCRIPTS
  {
    id: 'lua_event_system',
    name: 'Event System',
    language: 'Lua',
    category: 'Architecture',
    description: 'Custom event system with emitter pattern',
    difficulty: 'advanced',
    tags: ['events', 'architecture', 'patterns'],
    source: `-- Custom Event System
local EventEmitter = {}
EventEmitter.__index = EventEmitter

function EventEmitter.new()
  local self = setmetatable({}, EventEmitter)
  self._listeners = {}
  return self
end

function EventEmitter:on(eventName, callback)
  if not self._listeners[eventName] then
    self._listeners[eventName] = {}
  end
  table.insert(self._listeners[eventName], callback)
end

function EventEmitter:emit(eventName, ...)
  if self._listeners[eventName] then
    for _, callback in ipairs(self._listeners[eventName]) do
      pcall(callback, ...)
    end
  end
end

-- Usage
local emitter = EventEmitter.new()
emitter:on("playerJoined", function(name)
  print(name .. " joined!")
end)
emitter:emit("playerJoined", "Alice")
`,
  },
  {
    id: 'lua_state_machine',
    name: 'State Machine',
    language: 'Lua',
    category: 'Architecture',
    description: 'Finite state machine implementation',
    difficulty: 'advanced',
    tags: ['state-machine', 'fsm', 'patterns'],
    source: `-- Finite State Machine
local StateMachine = {}
StateMachine.__index = StateMachine

function StateMachine.new(initialState)
  local self = setmetatable({}, StateMachine)
  self.currentState = initialState
  self.states = {}
  return self
end

function StateMachine:addState(name, enter, update, exit)
  self.states[name] = {enter = enter, update = update, exit = exit}
end

function StateMachine:setState(newState)
  if self.states[self.currentState] and self.states[self.currentState].exit then
    self.states[self.currentState].exit()
  end
  self.currentState = newState
  if self.states[newState] and self.states[newState].enter then
    self.states[newState].enter()
  end
end

-- Usage
local sm = StateMachine.new("idle")
sm:addState("idle", function() print("Entered idle") end)
sm:addState("running", function() print("Started running") end)
sm:setState("running")
sm:setState("idle")
`,
  },

  // PYTHON SCRIPTS
  {
    id: 'python_hello',
    name: 'Hello World (Python)',
    language: 'Python',
    category: 'Basics',
    description: 'Simple Python print statement',
    difficulty: 'beginner',
    tags: ['python', 'print', 'basics'],
    source: `# Hello World in Python
print("Hello from NexaVerse!")
print("This is a Python script")

# Basic math
result = 10 + 5
print(f"10 + 5 = {result}")
`,
  },
  {
    id: 'python_list_operations',
    name: 'List Operations (Python)',
    language: 'Python',
    category: 'Data Structures',
    description: 'Work with Python lists',
    difficulty: 'beginner',
    tags: ['python', 'lists', 'data'],
    source: `# Python List Operations
inventory = ["sword", "shield", "potion"]

# Add item
inventory.append("torch")

# Remove item
inventory.remove("shield")

# Iterate
for item in inventory:
    print(f"- {item}")

# List comprehension
numbers = [x * 2 for x in range(1, 6)]
print(numbers)  # [2, 4, 6, 8, 10]
`,
  },
  {
    id: 'python_game_loop',
    name: 'Game Loop (Python)',
    language: 'Python',
    category: 'Game Logic',
    description: 'Basic game loop pattern',
    difficulty: 'intermediate',
    tags: ['python', 'game-loop', 'patterns'],
    source: `# Game Loop Pattern
import time

class GameState:
    def __init__(self):
        self.running = True
        self.tick = 0

    def update(self):
        self.tick += 1
        print(f"Tick: {self.tick}")

    def render(self):
        print(f"Frame {self.tick}")

    def run(self):
        while self.running and self.tick < 100:
            self.update()
            self.render()
            time.sleep(0.1)
        print("Game ended!")

# Usage
game = GameState()
game.run()
`,
  },
  {
    id: 'python_api_client',
    name: 'API Client (Python)',
    language: 'Python',
    category: 'Backend',
    description: 'HTTP API client for game backend',
    difficulty: 'intermediate',
    tags: ['python', 'api', 'http', 'backend'],
    source: `# Simple API Client
import urllib.request
import json

class GameAPI:
    def __init__(self, base_url):
        self.base_url = base_url

    def get_player(self, player_id):
        url = f"{self.base_url}/players/{player_id}"
        response = urllib.request.urlopen(url)
        return json.loads(response.read())

    def save_score(self, player_id, score):
        url = f"{self.base_url}/scores"
        data = json.dumps({"player_id": player_id, "score": score})
        req = urllib.request.Request(
            url, data=data.encode(),
            headers={"Content-Type": "application/json"}
        )
        response = urllib.request.urlopen(req)
        return response.status == 200

# Usage
api = GameAPI("https://api.nexaverse.io")
# player = api.get_player(1)
# api.save_score(1, 1000)
`,
  },

  // JAVASCRIPT/TYPESCRIPT SCRIPTS
  {
    id: 'js_hello',
    name: 'Hello World (JavaScript)',
    language: 'JavaScript',
    category: 'Basics',
    description: 'Simple JavaScript console log',
    difficulty: 'beginner',
    tags: ['javascript', 'console', 'basics'],
    source: `// Hello World in JavaScript
console.log("Hello from NexaVerse!");
console.log("This is a JavaScript script");

// ES6 arrow functions
const add = (a, b) => a + b;
console.log("10 + 5 =", add(10, 5));
`,
  },
  {
    id: 'js_class_example',
    name: 'Class Definition (JavaScript)',
    language: 'JavaScript',
    category: 'OOP',
    description: 'ES6 class syntax example',
    difficulty: 'intermediate',
    tags: ['javascript', 'classes', 'oop'],
    source: `// ES6 Class Example
class Player {
  constructor(name, health) {
    this.name = name;
    this.health = health;
    this.maxHealth = health;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    console.log(\`\${this.name} took \${amount} damage!\`);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  isDead() {
    return this.health <= 0;
  }
}

// Usage
const player = new Player("Hero", 100);
player.takeDamage(25);
console.log(\`Health: \${player.health}\`);
`,
  },
  {
    id: 'ts_typed_class',
    name: 'Typed Class (TypeScript)',
    language: 'TypeScript',
    category: 'OOP',
    description: 'TypeScript class with types',
    difficulty: 'intermediate',
    tags: ['typescript', 'types', 'oop'],
    source: `// TypeScript Typed Class
interface IGameObject {
  id: string;
  name: string;
  position: [number, number, number];
  update(): void;
}

class GameObject implements IGameObject {
  id: string;
  name: string;
  position: [number, number, number];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.position = [0, 0, 0];
  }

  update(): void {
    console.log(\`Updating \${this.name}\`);
  }

  moveTo(x: number, y: number, z: number): void {
    this.position = [x, y, z];
    console.log(\`Moved to (\${x}, \${y}, \${z})\`);
  }
}

// Usage
const obj = new GameObject("1", "MyObject");
obj.moveTo(10, 5, 20);
`,
  },
  {
    id: 'js_async_await',
    name: 'Async/Await (JavaScript)',
    language: 'JavaScript',
    category: 'Async',
    description: 'Async functions and await pattern',
    difficulty: 'advanced',
    tags: ['javascript', 'async', 'promises'],
    source: `// Async/Await Pattern
async function fetchPlayerStats(playerId) {
  try {
    const response = await fetch(\`/api/players/\${playerId}\`);
    const data = await response.json();
    console.log("Player stats:", data);
    return data;
  } catch (error) {
    console.error("Failed to fetch:", error);
  }
}

async function gameLoop() {
  const players = [1, 2, 3];
  for (const id of players) {
    const stats = await fetchPlayerStats(id);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Usage
gameLoop();
`,
  },

  // C# SCRIPTS
  {
    id: 'csharp_hello',
    name: 'Hello World (C#)',
    language: 'C#',
    category: 'Basics',
    description: 'Simple C# console application',
    difficulty: 'beginner',
    tags: ['csharp', 'console', 'basics'],
    source: `// Hello World in C#
using System;

public class Program {
    public static void Main() {
        Console.WriteLine("Hello from NexaVerse!");
        Console.WriteLine("This is a C# script");

        int result = 10 + 5;
        Console.WriteLine($"10 + 5 = {result}");
    }
}
`,
  },
  {
    id: 'csharp_class',
    name: 'Class Definition (C#)',
    language: 'C#',
    category: 'OOP',
    description: 'C# class with properties and methods',
    difficulty: 'intermediate',
    tags: ['csharp', 'classes', 'oop'],
    source: `// C# Class Example
using System;

public class Player {
    public string Name { get; set; }
    public int Health { get; private set; }
    public int MaxHealth { get; private set; }

    public Player(string name, int health) {
        Name = name;
        Health = health;
        MaxHealth = health;
    }

    public void TakeDamage(int amount) {
        Health = Math.Max(0, Health - amount);
        Console.WriteLine($"{Name} took {amount} damage!");
    }

    public void Heal(int amount) {
        Health = Math.Min(MaxHealth, Health + amount);
    }

    public bool IsDead() => Health <= 0;
}

// Usage
var player = new Player("Hero", 100);
player.TakeDamage(25);
Console.WriteLine($"Health: {player.Health}");
`,
  },
  {
    id: 'csharp_async',
    name: 'Async Methods (C#)',
    language: 'C#',
    category: 'Async',
    description: 'Asynchronous operations in C#',
    difficulty: 'advanced',
    tags: ['csharp', 'async', 'tasks'],
    source: `// C# Async/Await
using System;
using System.Threading.Tasks;
using System.Net.Http;

public class GameAPI {
    private static HttpClient client = new HttpClient();

    public async Task<string> GetPlayerAsync(int playerId) {
        try {
            var response = await client.GetAsync($"https://api.nexaverse.io/players/{playerId}");
            return await response.Content.ReadAsStringAsync();
        } catch (Exception ex) {
            Console.WriteLine($"Error: {ex.Message}");
            return null;
        }
    }

    public static async Task Main() {
        var api = new GameAPI();
        var data = await api.GetPlayerAsync(1);
        Console.WriteLine(data);
    }
}
`,
  },

  // HTML/CSS SCRIPTS
  {
    id: 'html_dashboard',
    name: 'Game Dashboard (HTML)',
    language: 'HTML/CSS',
    category: 'Frontend',
    description: 'HTML/CSS game dashboard UI',
    difficulty: 'intermediate',
    tags: ['html', 'css', 'ui', 'frontend'],
    source: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NexaVerse Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: white; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #16213e; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #0f3460; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #00d4ff; }
        .stat-label { font-size: 12px; color: #999; margin-top: 5px; }
        button { background: #00d4ff; color: #1a1a2e; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
        button:hover { background: #00a8cc; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>NexaVerse Dashboard</h1>
            <p>Welcome back, Player!</p>
        </div>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">1,250</div>
                <div class="stat-label">NexaCoins</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">42</div>
                <div class="stat-label">Games Played</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">15</div>
                <div class="stat-label">Friends Online</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">Level 28</div>
                <div class="stat-label">Current Rank</div>
            </div>
        </div>
        <button onclick="alert('Loading games...')">Browse Games</button>
    </div>
</body>
</html>
`,
  },

  // RUST, GO, JAVA
  {
    id: 'rust_game_struct',
    name: 'Game Structure (Rust)',
    language: 'Rust',
    category: 'Game Logic',
    description: 'Rust struct for game entity',
    difficulty: 'advanced',
    tags: ['rust', 'structs', 'game-logic'],
    source: `// Rust Game Entity
#[derive(Debug)]
pub struct Player {
    name: String,
    health: i32,
    max_health: i32,
    position: (f32, f32, f32),
}

impl Player {
    pub fn new(name: String) -> Self {
        Player {
            name,
            health: 100,
            max_health: 100,
            position: (0.0, 0.0, 0.0),
        }
    }

    pub fn take_damage(&mut self, amount: i32) {
        self.health = (self.health - amount).max(0);
        println!("{} took {} damage!", self.name, amount);
    }

    pub fn is_dead(&self) -> bool {
        self.health <= 0
    }
}

fn main() {
    let mut player = Player::new("Hero".to_string());
    player.take_damage(25);
    println!("Health: {}", player.health);
}
`,
  },
  {
    id: 'go_server',
    name: 'Web Server (Go)',
    language: 'Go',
    category: 'Backend',
    description: 'Simple Go HTTP server',
    difficulty: 'intermediate',
    tags: ['go', 'http', 'server', 'backend'],
    source: `// Go HTTP Server
package main

import (
    "fmt"
    "log"
    "net/http"
    "encoding/json"
)

type Player struct {
    Name   string \`json:"name"\`
    Score  int    \`json:"score"\`
}

func handlePlayers(w http.ResponseWriter, r *http.Request) {
    players := []Player{
        {"Alice", 1000},
        {"Bob", 850},
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(players)
}

func main() {
    http.HandleFunc("/api/players", handlePlayers)
    fmt.Println("Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
`,
  },
  {
    id: 'java_game_class',
    name: 'Game Class (Java)',
    language: 'Java',
    category: 'Game Logic',
    description: 'Java class for game logic',
    difficulty: 'intermediate',
    tags: ['java', 'oop', 'game-logic'],
    source: `// Java Game Class
public class Player {
    private String name;
    private int health;
    private int maxHealth;

    public Player(String name) {
        this.name = name;
        this.health = 100;
        this.maxHealth = 100;
    }

    public void takeDamage(int amount) {
        this.health = Math.max(0, this.health - amount);
        System.out.println(name + " took " + amount + " damage!");
    }

    public void heal(int amount) {
        this.health = Math.min(maxHealth, this.health + amount);
    }

    public boolean isDead() {
        return health <= 0;
    }

    public static void main(String[] args) {
        Player player = new Player("Hero");
        player.takeDamage(25);
        System.out.println("Health: " + player.health);
    }
}
`,
  },

  // BACKEND TEMPLATES
  {
    id: 'nodejs_express_api',
    name: 'Express API Server (Node.js)',
    language: 'JavaScript',
    category: 'Backend',
    description: 'Express.js REST API template',
    difficulty: 'intermediate',
    tags: ['nodejs', 'express', 'api', 'backend'],
    source: `// Express.js API Server
const express = require('express');
const app = express();

app.use(express.json());

let scores = [];

app.post('/api/scores', (req, res) => {
    const { playerId, score } = req.body;
    scores.push({ playerId, score, timestamp: Date.now() });
    res.json({ success: true, message: 'Score saved' });
});

app.get('/api/scores/:playerId', (req, res) => {
    const playerScores = scores.filter(s => s.playerId == req.params.playerId);
    res.json(playerScores);
});

app.get('/api/leaderboard', (req, res) => {
    const top = scores.sort((a, b) => b.score - a.score).slice(0, 10);
    res.json(top);
});

const PORT = 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`,
  },
  {
    id: 'python_flask_api',
    name: 'Flask API Server (Python)',
    language: 'Python',
    category: 'Backend',
    description: 'Flask REST API template',
    difficulty: 'intermediate',
    tags: ['python', 'flask', 'api', 'backend'],
    source: `# Flask API Server
from flask import Flask, request, jsonify

app = Flask(__name__)
scores = []

@app.route('/api/scores', methods=['POST'])
def save_score():
    data = request.json
    scores.append({
        'playerId': data['playerId'],
        'score': data['score']
    })
    return jsonify({'success': True})

@app.route('/api/scores/<player_id>', methods=['GET'])
def get_scores(player_id):
    player_scores = [s for s in scores if s['playerId'] == int(player_id)]
    return jsonify(player_scores)

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    top = sorted(scores, key=lambda x: x['score'], reverse=True)[:10]
    return jsonify(top)

if __name__ == '__main__':
    app.run(port=3000)
`,
  },
  {
    id: 'sql_database',
    name: 'SQL Database Schema',
    language: 'SQL',
    category: 'Backend',
    description: 'SQL schema for game database',
    difficulty: 'intermediate',
    tags: ['sql', 'database', 'schema'],
    source: `-- Game Database Schema
CREATE TABLE players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    game_id INT,
    score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    player_id INT NOT NULL,
    title VARCHAR(100),
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for performance
CREATE INDEX idx_player_scores ON scores(player_id);
CREATE INDEX idx_achievement_player ON achievements(player_id);
`,
  },
];

export const SCRIPT_CATEGORIES = [
  'Basics',
  'Physics',
  'Input',
  'Game Logic',
  'AI',
  'Architecture',
  'Data Structures',
  'Async',
  'OOP',
  'Frontend',
  'Backend',
];
