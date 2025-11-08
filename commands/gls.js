const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'gls',
    description: 'Busca canales bloqueados por uno o varios Pokémon específicos en todos los servidores, mostrando un conteo individual.',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        // 1. Parsear los argumentos: dividir por coma, limpiar espacios y convertir a minúsculas
        const searchPokemonNames = args.join(' ').toLowerCase().split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0); 

        if (searchPokemonNames.length === 0) {
            return message.reply('❌ Proporciona uno o más nombres de Pokémon separados por comas para buscar (ej: `!gls pichu, pikachu`).');
        }

        const searchPokemonString = searchPokemonNames.join(', ');
        const pokemonCounts = {}; 

        // Inicializar el conteo de todos los Pokémon buscados a 0
        searchPokemonNames.forEach(name => {
            pokemonCounts[name] = 0;
        });

        try {
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    const channel = client.channels.cache.get(id);
                    if (!channel) return null;
                    
                    let matchedName = null;
                    // Lógica de filtrado
                    const isMatch = searchPokemonNames.some(searchName => {
                        if (data.pokemon.toLowerCase().includes(searchName)) {
                            // Almacenamos el nombre buscado que coincidió para incrementar su contador.
                            matchedName = searchName;
                            return true;
                        }
                        return false;
                    });
                    
                    if (isMatch) {
                        // Incrementar el contador
                        pokemonCounts[matchedName]++; 

                        return {
                            id,
                            guildId: channel.guild.id,
                            channelName: channel.name,
                            guildName: channel.guild.name,
                            pokemon: data.pokemon, // Nombre completo del Pokémon bloqueado
                            type: data.type === 'private' ? 'Privado' : 'Público'
                        };
                    } else {
                        return null;
                    }
                })
                .filter(item => item !== null)
                .sort((a, b) => a.pokemon.localeCompare(b.pokemon));

            // Función para generar el resumen de conteo
            const getCountSummary = (names, counts) => {
                // Iterar sobre la lista de nombres para asegurar que todos aparezcan
                return names
                    .map(name => `**${name.charAt(0).toUpperCase() + name.slice(1)}**: ${counts[name] || 0}`)
                    .join(' | ');
            };

            const itemsPerPage = 5;
            const totalPages = Math.ceil(lockedList.length / itemsPerPage) || 1; 

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);
                const summary = getCountSummary(searchPokemonNames, pokemonCounts);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🌍 Bloqueos globales coincidentes (${lockedList.length} Canales)`)
                    .setDescription(
                         `*Coincidencias por Pokémon:* ${summary}\n\n` + 
                        (lockedList.length > 0 ? 
                            currentItems.map(item => 
                                `🔒 **${item.pokemon}** (${item.guildName} - ${item.channelName})\n` +
                                `• Tipo: ${item.type}\n` +
                                `• [Ir al Canal](https://discord.com/channels/${item.guildId}/${item.id})`
                            ).join('\n\n')
                         : '*No se encontraron canales bloqueados que coincidan con los términos buscados.*')
                    )
                    .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

                return embed;
            };
            
            // Caso especial para respuesta sin resultados
            if (lockedList.length === 0) {
                 return message.reply({ embeds: [generateEmbed(0)] });
            }


            const initialState = { 
                currentPage: 0,
                lockedList,
                itemsPerPage,
                totalPages,
                pokemon: searchPokemonString, 
                pokemonCounts, 
                searchPokemonNames, // Guardamos la lista de nombres para la paginación
                messageAuthorId: message.author.id,
                commandName: 'gls',
                customPrefix: 'gls_'
            };
            const reply = await message.reply({ 
                embeds: [generateEmbed(initialState.currentPage)], 
                components: [generatePaginationButtons(initialState.currentPage, totalPages, 'gls_')],
                fetchReply: true
            });

            paginationStates.set(reply.id, initialState);
        } catch (error) {
            console.error('❌ Error en comando GLS:', error);
            message.reply('❌ Ocurrió un error al buscar los canales bloqueados globalmente.');
        }
    },
    handlePagination: async (interaction, state, generatePaginationButtons) => {
        if (interaction.customId.includes('_close_list')) return interaction.message.delete().catch(() => {});
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'gls_prev_page' && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === 'gls_next_page' && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        } else if (interaction.customId === 'gls_close_list') {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.lockedList.slice(start, end);
        
        // Función para generar el resumen de conteo (repetida para la paginación)
        const getCountSummary = (names, counts) => {
            return names
                .map(name => `**${name.charAt(0).toUpperCase() + name.slice(1)}**: ${counts[name] || 0}`)
                .join(' | ');
        };
        const summary = getCountSummary(state.searchPokemonNames, state.pokemonCounts);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🌍 Bloqueos globales coincidentes (${state.lockedList.length} Canales)`)
            .setDescription(
                `*Coincidencias por Pokémon:* ${summary}\n\n` + 
                currentItems.map(item =>
                    `🔒 **${item.pokemon}** (${item.guildName} - ${item.channelName})\n` +
                    `• Tipo: ${item.type}\n` +
                    `• [Ir al Canal](https://discord.com/channels/${item.guildId}/${item.id})`
                ).join('\n\n')
            )
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({ 
            embeds: [embed], 
            components: [generatePaginationButtons(state.currentPage, state.totalPages, 'gls_')]
        });
    }
};
