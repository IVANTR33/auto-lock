const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'gls',
    description: 'Busca canales bloqueados por uno o varios Pokémon específicos en todos los servidores.',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        // 1. Parsear los argumentos: dividir por coma, limpiar espacios y convertir a minúsculas
        const searchPokemonNames = args.join(' ').toLowerCase().split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0); // Filtrar cadenas vacías

        if (searchPokemonNames.length === 0) {
            return message.reply('❌ Proporciona uno o más nombres de Pokémon separados por comas para buscar (ej: `!gls pichu, pikachu`).');
        }

        const searchPokemonString = searchPokemonNames.join(', '); // String para usar en el título del embed y respuestas

        try {
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    const channel = client.channels.cache.get(id);
                    if (!channel) return null;

                    // 2. Lógica de filtrado: el canal se incluye si su Pokémon incluye AL MENOS UNO de los nombres buscados.
                    const isMatch = searchPokemonNames.some(searchName => 
                        data.pokemon.toLowerCase().includes(searchName)
                    );
                    
                    if (isMatch) {
                        return {
                            id,
                            guildId: channel.guild.id,
                            channelName: channel.name,
                            guildName: channel.guild.name,
                            pokemon: data.pokemon,
                            type: data.type === 'private' ? 'Privado' : 'Público'
                        };
                    } else {
                        return null;
                    }
                })
                .filter(item => item !== null)
                .sort((a, b) => a.pokemon.localeCompare(b.pokemon));

            if (lockedList.length === 0) {
                return message.reply(`No hay canales bloqueados que coincidan con "${searchPokemonString}" en ningún servidor.`);
            }

            const itemsPerPage = 5;
            const totalPages = Math.ceil(lockedList.length / itemsPerPage);

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    // 3. Título ajustado para múltiples Pokémon
                    .setTitle(`🌍 Bloqueos globales coincidentes (${lockedList.length})`)
                    .setDescription(`Búsqueda: **${searchPokemonString}**\n\n` + 
                        currentItems.map(item => 
                            `🔒 **${item.pokemon}** (${item.guildName} - ${item.channelName})\n` +
                            `• Tipo: ${item.type}\n` +
                            `• [Ir al Canal](https://discord.com/channels/${item.guildId}/${item.id})`
                        ).join('\n\n')
                    )
                    .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

                return embed;
            };

            const initialState = { 
                currentPage: 0,
                lockedList,
                itemsPerPage,
                totalPages,
                pokemon: searchPokemonString, // Guardamos el string de búsqueda
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
            // Ya no es necesario, el primer if lo maneja. Se deja aquí por si acaso, aunque es redundante.
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.lockedList.slice(start, end);

        // 4. Se ha cambiado el título y añadido el campo de búsqueda
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🌍 Bloqueos globales coincidentes (${state.lockedList.length})`)
            .setDescription(`Búsqueda: **${state.pokemon}**\n\n` + 
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
