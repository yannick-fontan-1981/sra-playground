import type {LevelSpec} from './core.js';
export const SS14_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss14-01",
    "title": "L’atelier des deux voix",
    "rows": [
      "####################",
      "#..................#",
      "#...............m.m#",
      "#..................#",
      "#..................#",
      "#...To.............#",
      "#...B..............#",
      "#.....o#...........#",
      "#..................#",
      "#.....o............#",
      "#..............o...#",
      "#~~#~~~~~#~~~~~~~~~#",
      "#~~~~~~~~~~~~~~....#",
      "#~~~~~~~~~~~~~~....#",
      "###############....#",
      "###############g...#",
      "###############....#",
      "###############..g.#",
      "###############....#",
      "####################"
    ],
    "facing": "W",
    "mirrors": [
      {
        "at": {
          "x": 16,
          "y": 8
        },
        "facing": "SW"
      }
    ],
    "circuits": [
      {
        "id": "atelier",
        "buttons": [
          {
            "x": 12,
            "y": 4
          }
        ],
        "color": 11
      }
    ],
    "gates": [
      {
        "at": {
          "x": 15,
          "y": 10
        },
        "circuit": "atelier",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 16,
          "y": 2
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss14-02",
    "title": "La relève silencieuse",
    "rows": [
      "####################",
      "####################",
      "#########..#.#..####",
      "#.o.....#.......####",
      "#########..........#",
      "#.B............#g..#",
      "#.#######......#...#",
      "#.o.....#......#..g#",
      "#.####.........#####",
      "######.........#####",
      "######T.....o..#####",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "rails",
        "buttons": [
          {
            "x": 5,
            "y": 3
          },
          {
            "x": 5,
            "y": 7
          }
        ],
        "color": 11
      },
      {
        "id": "alcove",
        "buttons": [
          {
            "x": 12,
            "y": 2
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 5
        },
        "circuit": "rails",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 4
        },
        "circuit": "alcove",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss14-03",
    "title": "L’appui sous le partenaire",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~........~",
      "~~~~~~~~~~~g.....g.~",
      "~~~~~~~~~~~........~",
      "~~~~....~~~........~",
      "~~~~.#~.~~~~~~~~~~~~",
      "~........~....~....~",
      "~....T...#.........~",
      "~........~.........~",
      "~........~.........~",
      "~........~.........~",
      "~........~.........~",
      "~........~.........~",
      "~........~.........~",
      "~......B.~.........~",
      "~........~.........~",
      "~........s.........~",
      "~........~.........~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 8
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "haut-quai",
        "buttons": [
          {
            "x": 14,
            "y": 9
          }
        ],
        "color": 11
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 14,
          "y": 5
        },
        "circuit": "haut-quai",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss14-04",
    "title": "Les deux départs sans geste",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~......~~.....B.o.~",
      "~~g...g.~~.........~",
      "~~......~~.........~",
      "~~......~~.........~",
      "~~~~~~~.~~.........~",
      "~~~~~~~............~",
      "~~~~~~~~~~.........~",
      "~~~~~~~~~~.........~",
      "~~.......~.........~",
      "~~.......~.........~",
      "~~.T...#.~.........~",
      "~~.......~.........~",
      "~~.......~~~~~~~~~~~",
      "~~.......~~~~~~~~~~~",
      "~~.......~~~~~~~~~~~",
      "~~........~~~~~~~~~~",
      "~~........~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 3,
          "y": 11
        },
        "facing": "NE"
      },
      {
        "at": {
          "x": 12,
          "y": 7
        },
        "facing": "SW"
      }
    ],
    "circuits": [
      {
        "id": "accord",
        "buttons": [
          {
            "x": 8,
            "y": 13
          },
          {
            "x": 14,
            "y": 10
          }
        ],
        "color": 11
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 9,
          "y": 13
        },
        "circuit": "accord",
        "activeWhen": "pressed"
      }
    ],
    "gates": [
      {
        "at": {
          "x": 7,
          "y": 6
        },
        "circuit": "accord",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss14-05",
    "title": "Les gardiens et le poids retiré",
    "rows": [
      "##################",
      "##################",
      "###m....##########",
      "#######.##########",
      "#..B....##########",
      "#.#####.##########",
      "#.####......#m####",
      "#.####......#.####",
      "#.oT........#.####",
      "#.#.........#.####",
      "#.o.#.......#.####",
      "#...........#.####",
      "##..........######",
      "##.....#.#########",
      "###....#.#########",
      "###..##....#######",
      "#######g..g#######",
      "##################",
      "##################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 8
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 7,
            "y": 4
          },
          {
            "x": 13,
            "y": 11
          },
          {
            "x": 4,
            "y": 9
          },
          {
            "x": 2,
            "y": 11
          },
          {
            "x": 10,
            "y": 8
          }
        ],
        "color": 11
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 13
        },
        "circuit": "sortie",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss14-06",
    "title": "Le passage des deux presses",
    "rows": [
      "####################",
      "####################",
      "####################",
      "########.#.#########",
      "########..##########",
      "######.#....########",
      "######o~......######",
      "######.#...##.######",
      "######.#.....o.#####",
      "######.#...##~~#####",
      "######.####........#",
      "######T####........#",
      "#.......###........#",
      "#.......###........#",
      "#.......###........#",
      "#.......######.#####",
      "#.B.....###...m..m.#",
      "#.......###g......g#",
      "#.......###........#",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 10
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "premiere-presse",
        "buttons": [
          {
            "x": 3,
            "y": 14
          }
        ],
        "color": 10
      },
      {
        "id": "accord-presse",
        "buttons": [
          {
            "x": 8,
            "y": 4
          },
          {
            "x": 9,
            "y": 4
          }
        ],
        "color": 15
      },
      {
        "id": "retour-sous-charge",
        "buttons": [
          {
            "x": 13,
            "y": 8
          }
        ],
        "color": 9
      },
      {
        "id": "miroir-final",
        "buttons": [
          {
            "x": 13,
            "y": 12
          }
        ],
        "color": 11
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 6
        },
        "circuit": "premiere-presse",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 13,
          "y": 8
        },
        "circuit": "accord-presse",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 13,
          "y": 7
        },
        "circuit": "miroir-final",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 15
        },
        "circuit": "miroir-final",
        "direction": "S",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 14,
          "y": 9
        },
        "circuit": "retour-sous-charge",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss14-07",
    "title": "La pierre des trois traversées",
    "rows": [
      "..........~........#",
      ".....~....~........#",
      "....~.~...~........#",
      ".....~....~........#",
      "..#.......~...####.#",
      "..........~....o.#.#",
      "..#.......~...####.#",
      "..........~........#",
      "..........~........#",
      "..........~........#",
      "~~~~#s~~~~~~~~~~~~~#",
      "..........~....#...#",
      "..........~....#####",
      "..........~....#...#",
      "...B......~....#.g.#",
      "..........~....#...#",
      "..........~........#",
      ".....T....~....#.g.#",
      "..........~....#...#",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 5,
          "y": 15
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "reserve",
        "buttons": [
          {
            "x": 5,
            "y": 15
          }
        ],
        "color": 11
      },
      {
        "id": "deux-poids",
        "buttons": [
          {
            "x": 5,
            "y": 2
          },
          {
            "x": 5,
            "y": 5
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 13,
          "y": 5
        },
        "circuit": "reserve",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 16
        },
        "circuit": "deux-poids",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss14-08",
    "title": "Le dernier accord des deux rives",
    "rows": [
      "####################",
      "#........~~....#...#",
      "#........~~....#.g.#",
      "#..m.B.m.~~........#",
      "#...#.#..~~....#.g.#",
      "#...#.#..~~...o#...#",
      "#...#.#..~~....#####",
      "#........~~........#",
      "#........~~........#",
      "#........~~........#",
      "#....T#..~~........#",
      "#........~~........#",
      "#.......#~~........#",
      "#.......#~~........#",
      "#....#...~~........#",
      "#........~~........#",
      "#.......#~~#.o.....#",
      "#........~~........#",
      "#........~~........#",
      "####################"
    ],
    "facing": "S",
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 14
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "choeur",
        "buttons": [
          {
            "x": 3,
            "y": 5
          },
          {
            "x": 7,
            "y": 5
          }
        ],
        "color": 11
      },
      {
        "id": "presse",
        "buttons": [
          {
            "x": 6,
            "y": 14
          }
        ],
        "color": 9
      },
      {
        "id": "charge",
        "buttons": [
          {
            "x": 11,
            "y": 14
          }
        ],
        "color": 15
      },
      {
        "id": "dernier-accord",
        "buttons": [
          {
            "x": 3,
            "y": 7
          },
          {
            "x": 7,
            "y": 7
          },
          {
            "x": 14,
            "y": 4
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 14
        },
        "circuit": "presse",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 13
        },
        "circuit": "presse",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 15
        },
        "circuit": "presse",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 12
        },
        "circuit": "charge",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 14
        },
        "circuit": "charge",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 15
        },
        "circuit": "charge",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 16
        },
        "circuit": "charge",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 13
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 7,
          "y": 14
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 7,
          "y": 15
        },
        "circuit": "charge",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 7,
          "y": 13
        },
        "circuit": "choeur",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 15,
          "y": 3
        },
        "circuit": "dernier-accord",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 3
        },
        "circuit": "choeur",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 9,
          "y": 8
        },
        "circuit": "choeur",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 8
        },
        "circuit": "choeur",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 15
        },
        "circuit": "dernier-accord",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 12
        },
        "circuit": "presse",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 13
        },
        "circuit": "presse",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 12
        },
        "circuit": "presse",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 13
        },
        "circuit": "presse",
        "activeWhen": "released"
      }
    ]
  }
];
